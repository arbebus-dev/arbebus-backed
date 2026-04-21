import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { API_BASE } from "../constants/api";
import {
    startLeaveAlertBackgroundUpdates,
    stopLeaveAlertBackgroundUpdates,
} from "../core/services/alerts/leaveAlertBackground";
import {
    buildLeaveAlertPlan,
    formatClock,
    formatCountdown,
    type Coordinate,
} from "../core/services/alerts/leaveAlertService";
import {
    clearActiveLeaveAlert,
    getActiveLeaveAlert,
    saveActiveLeaveAlert,
    type ActiveLeaveAlert,
} from "../core/services/alerts/leaveAlertStorage";
import {
    cancelScheduledNotification,
    ensureNotificationsReady,
    scheduleLeaveAlertNotification,
} from "../core/services/alerts/notifications";
import { registerDeviceForBackendPush } from "../core/services/alerts/pushRegistration";

type LeaveAlertSource = "leave_alert";

type Params = {
  isPro: boolean;
  userCoordinate: Coordinate | null;
  pickupCoordinate: Coordinate | null;
  destinationCoordinate?: Coordinate | null;
  pickupLabel: string;
  destinationLabel: string;
  routeEtaMinutes: number | null;
  liveEtaSeconds: number | null;
  selectedBusId?: string | null;
  routeId?: string | null;
  onOpenPaywall: (source: LeaveAlertSource) => void | Promise<void>;
};

type RegisteredPush = {
  deviceId: string;
  expoPushToken: string;
} | null;

export function useLeaveAlert({
  isPro,
  userCoordinate,
  pickupCoordinate,
  destinationCoordinate,
  pickupLabel,
  destinationLabel,
  routeEtaMinutes,
  liveEtaSeconds,
  selectedBusId,
  routeId,
  onOpenPaywall,
}: Params) {
  const [activeAlert, setActiveAlert] = useState<ActiveLeaveAlert | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [registeredPush, setRegisteredPush] = useState<RegisteredPush>(null);

  const effectiveRouteEtaSeconds = useMemo(() => {
    if (liveEtaSeconds && liveEtaSeconds > 0) return liveEtaSeconds;
    if (routeEtaMinutes && routeEtaMinutes > 0) {
      return Math.round(routeEtaMinutes * 60);
    }
    return null;
  }, [liveEtaSeconds, routeEtaMinutes]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const stored = await getActiveLeaveAlert();

      if (mounted) {
        setActiveAlert(stored);
      }

      try {
        const push = await registerDeviceForBackendPush();
        if (mounted) {
          setRegisteredPush(push);
        }
      } catch (error) {
        console.log("registerDeviceForBackendPush error:", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const syncAlertToBackend = useCallback(
    async (alert: ActiveLeaveAlert, deviceId: string) => {
      if (!routeId) {
        throw new Error("Missing routeId for V3 backend leave alert");
      }

      if (!alert.pickupCoordinate) {
        throw new Error("Missing pickupCoordinate for V3 backend leave alert");
      }

      const response = await fetch(`${API_BASE}/leave-alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId,
          alertId: alert.id,
          routeId: String(routeId).toUpperCase(),
          pickupLabel: alert.pickupLabel,
          destinationLabel: alert.destinationLabel,
          pickupCoordinate: alert.pickupCoordinate,
          arrivalAtIso: alert.busArrivalAtIso,
          triggerAtIso: alert.triggerAtIso,
          walkSeconds: alert.walkSeconds,
          prepSeconds: alert.prepSeconds,
          selectedBusId: alert.selectedBusId ?? null,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `Leave alert backend sync failed: ${response.status} ${text}`
        );
      }
    },
    [routeId]
  );

  const disableLeaveAlert = useCallback(async () => {
    if (!activeAlert) return;

    setIsBusy(true);

    try {
      await cancelScheduledNotification(activeAlert.notificationId);

      if (registeredPush?.deviceId) {
        await fetch(`${API_BASE}/leave-alerts/${activeAlert.id}`, {
          method: "DELETE",
        });
      }

      await clearActiveLeaveAlert();
      await stopLeaveAlertBackgroundUpdates();
      setActiveAlert(null);

      Alert.alert("Leave Alert", "Leave alert išjungtas.");
    } finally {
      setIsBusy(false);
    }
  }, [activeAlert, registeredPush?.deviceId]);

  const enableLeaveAlert = useCallback(async () => {
    if (!isPro) {
      await onOpenPaywall("leave_alert");
      return;
    }

    if (!registeredPush?.deviceId) {
      Alert.alert(
        "Push not ready",
        "Pirmiausia leisk notifications, kad backend galėtų siųsti leave alert."
      );
      return;
    }

    if (!routeId) {
      Alert.alert(
        "Leave Alert",
        "Dar neturime maršruto ID. Pabandyk pasirinkti konkretų autobusą ar maršrutą."
      );
      return;
    }

    if (!userCoordinate || !pickupCoordinate) {
      Alert.alert(
        "Leave Alert",
        "Pirmiausia pasirink kelionę ir leisk lokacijos prieigą."
      );
      return;
    }

    if (!effectiveRouteEtaSeconds) {
      Alert.alert(
        "Leave Alert",
        "Dar neturime pakankamai ETA duomenų šitam maršrutui."
      );
      return;
    }

    setIsBusy(true);

    try {
      const notificationsReady = await ensureNotificationsReady();

      if (!notificationsReady) {
        Alert.alert(
          "Notifications išjungti",
          "Leisk notifications, kad Leave Alert galėtų veikti."
        );
        return;
      }

      const plan = buildLeaveAlertPlan({
        userCoordinate,
        pickupCoordinate,
        routeEtaSeconds: effectiveRouteEtaSeconds,
        prepMinutes: 2,
      });

      if (activeAlert?.notificationId) {
        await cancelScheduledNotification(activeAlert.notificationId);
      }

      const localNotificationId = await scheduleLeaveAlertNotification({
        triggerAt: plan.triggerAt,
        pickupLabel,
        destinationLabel,
      });

      let backgroundEnabled = false;

      try {
        backgroundEnabled = await startLeaveAlertBackgroundUpdates();
      } catch (error) {
        console.log("Background location not enabled:", error);
      }

      const nextAlert: ActiveLeaveAlert = {
        id: activeAlert?.id || `leave-alert-${Date.now()}`,
        notificationId: localNotificationId,
        busArrivalAtIso: plan.busArrivalAt.toISOString(),
        triggerAtIso: plan.triggerAt.toISOString(),
        pickupCoordinate,
        destinationCoordinate: destinationCoordinate ?? null,
        pickupLabel,
        destinationLabel,
        walkSeconds: plan.walkSeconds,
        prepSeconds: plan.prepSeconds,
        routeEtaSeconds: effectiveRouteEtaSeconds,
        selectedBusId: selectedBusId ?? null,
        backgroundEnabled,
        updatedAtIso: new Date().toISOString(),
      };

      await saveActiveLeaveAlert(nextAlert);
      await syncAlertToBackend(nextAlert, registeredPush.deviceId);
      setActiveAlert(nextAlert);

      Alert.alert(
        "Leave Alert aktyvuotas",
        plan.shouldLeaveNow
          ? "Laikas ruoštis jau dabar. Vietinis ir backend leave alert aktyvuoti."
          : `Priminimas suplanuotas ${formatClock(
              plan.triggerAt
            )}. Iki jo liko ${formatCountdown(plan.notifyInSeconds)}.`
      );
    } catch (error) {
      console.log("enableLeaveAlert error:", error);
      Alert.alert(
        "Leave Alert klaida",
        "Nepavyko išsaugoti leave alert backend sistemoje."
      );
    } finally {
      setIsBusy(false);
    }
  }, [
    isPro,
    registeredPush,
    routeId,
    onOpenPaywall,
    userCoordinate,
    pickupCoordinate,
    effectiveRouteEtaSeconds,
    activeAlert,
    pickupLabel,
    destinationLabel,
    destinationCoordinate,
    selectedBusId,
    syncAlertToBackend,
  ]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (
        !activeAlert ||
        !registeredPush?.deviceId ||
        !routeId ||
        !userCoordinate ||
        !pickupCoordinate ||
        !effectiveRouteEtaSeconds
      ) {
        return;
      }

      const nextPlan = buildLeaveAlertPlan({
        userCoordinate,
        pickupCoordinate,
        routeEtaSeconds: effectiveRouteEtaSeconds,
        prepMinutes: activeAlert.prepSeconds / 60,
      });

      const previousTriggerMs = new Date(activeAlert.triggerAtIso).getTime();
      const nextTriggerMs = nextPlan.triggerAt.getTime();

      if (Math.abs(previousTriggerMs - nextTriggerMs) < 60 * 1000) {
        return;
      }

      const nextLocalNotificationId = await scheduleLeaveAlertNotification({
        triggerAt: nextPlan.triggerAt,
        pickupLabel,
        destinationLabel,
      });

      await cancelScheduledNotification(activeAlert.notificationId);

      const nextAlert: ActiveLeaveAlert = {
        ...activeAlert,
        notificationId: nextLocalNotificationId,
        busArrivalAtIso: nextPlan.busArrivalAt.toISOString(),
        triggerAtIso: nextPlan.triggerAt.toISOString(),
        walkSeconds: nextPlan.walkSeconds,
        routeEtaSeconds: effectiveRouteEtaSeconds,
        updatedAtIso: new Date().toISOString(),
      };

      await saveActiveLeaveAlert(nextAlert);
      await syncAlertToBackend(nextAlert, registeredPush.deviceId);

      if (!cancelled) {
        setActiveAlert(nextAlert);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeAlert,
    registeredPush?.deviceId,
    routeId,
    userCoordinate,
    pickupCoordinate,
    effectiveRouteEtaSeconds,
    pickupLabel,
    destinationLabel,
    syncAlertToBackend,
  ]);

  const leaveAlertEnabled = Boolean(activeAlert);

  const leaveAlertSummary = useMemo(() => {
    if (!activeAlert) return "Set leave alert";
    return `Alert ${formatClock(new Date(activeAlert.triggerAtIso))}`;
  }, [activeAlert]);

  const handleLeaveAlertPress = useCallback(async () => {
    if (isBusy) return;

    if (activeAlert) {
      await disableLeaveAlert();
      return;
    }

    await enableLeaveAlert();
  }, [activeAlert, disableLeaveAlert, enableLeaveAlert, isBusy]);

  return {
    leaveAlertEnabled,
    leaveAlertSummary,
    leaveAlertBusy: isBusy,
    handleLeaveAlertPress,
  };
}