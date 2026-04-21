import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import {
    buildLeaveAlertPlan,
    formatClock,
    type Coordinate,
} from "./leaveAlertService";
import {
    clearActiveLeaveAlert,
    getActiveLeaveAlert,
    saveActiveLeaveAlert,
} from "./leaveAlertStorage";
import {
    cancelScheduledNotification,
    scheduleLeaveAlertNotification,
} from "./notifications";

export const ARBEBUS_LEAVE_ALERT_TASK = "arbebus-leave-alert-task";

const globalScope = globalThis as typeof globalThis & {
  __arbebusLeaveAlertTaskDefined?: boolean;
};

if (!globalScope.__arbebusLeaveAlertTaskDefined) {
  TaskManager.defineTask(ARBEBUS_LEAVE_ALERT_TASK, async ({ data, error }) => {
    if (error) {
      console.log("Leave alert background task error:", error.message);
      return;
    }

    const activeAlert = await getActiveLeaveAlert();
    if (!activeAlert) return;

    const locations = (data as any)?.locations;
    const latestLocation = Array.isArray(locations) ? locations[0] : null;

    if (!latestLocation?.coords) return;

    const currentUserCoordinate: Coordinate = {
      latitude: latestLocation.coords.latitude,
      longitude: latestLocation.coords.longitude,
    };

    const now = Date.now();
    const busArrivalAtMs = new Date(activeAlert.busArrivalAtIso).getTime();

    if (!Number.isFinite(busArrivalAtMs) || busArrivalAtMs <= now) {
      await cancelScheduledNotification(activeAlert.notificationId);
      await clearActiveLeaveAlert();
      return;
    }

    const remainingRouteEtaSeconds = Math.max(
      60,
      Math.round((busArrivalAtMs - now) / 1000)
    );

    const plan = buildLeaveAlertPlan({
      userCoordinate: currentUserCoordinate,
      pickupCoordinate: activeAlert.pickupCoordinate,
      routeEtaSeconds: remainingRouteEtaSeconds,
      prepMinutes: activeAlert.prepSeconds / 60,
    });

    const previousTriggerMs = new Date(activeAlert.triggerAtIso).getTime();
    const nextTriggerMs = plan.triggerAt.getTime();

    if (Math.abs(previousTriggerMs - nextTriggerMs) < 60 * 1000) {
      return;
    }

    await cancelScheduledNotification(activeAlert.notificationId);

    const nextNotificationId = await scheduleLeaveAlertNotification({
      triggerAt: plan.triggerAt,
      pickupLabel: activeAlert.pickupLabel,
      destinationLabel: activeAlert.destinationLabel,
    });

    await saveActiveLeaveAlert({
      ...activeAlert,
      notificationId: nextNotificationId,
      triggerAtIso: plan.triggerAt.toISOString(),
      walkSeconds: plan.walkSeconds,
      routeEtaSeconds: remainingRouteEtaSeconds,
      backgroundEnabled: true,
      updatedAtIso: new Date().toISOString(),
    });

    console.log(
      `Leave alert rescheduled in background for ${formatClock(plan.triggerAt)}`
    );
  });

  globalScope.__arbebusLeaveAlertTaskDefined = true;
}

export async function startLeaveAlertBackgroundUpdates() {
  const fg = await Location.getForegroundPermissionsAsync();

  if (!fg.granted) {
    const fgReq = await Location.requestForegroundPermissionsAsync();
    if (!fgReq.granted) return false;
  }

  const bg = await Location.getBackgroundPermissionsAsync();

  if (!bg.granted) {
    const bgReq = await Location.requestBackgroundPermissionsAsync();
    if (!bgReq.granted) return false;
  }

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
    ARBEBUS_LEAVE_ALERT_TASK
  );

  if (alreadyStarted) return true;

  await Location.startLocationUpdatesAsync(ARBEBUS_LEAVE_ALERT_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 150,
    deferredUpdatesDistance: 150,
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: false,
    activityType: Location.ActivityType.OtherNavigation,
    foregroundService: {
      notificationTitle: "Arbebus leave alerts",
      notificationBody: "Background leave alert monitoring is active.",
    },
  });

  return true;
}

export async function stopLeaveAlertBackgroundUpdates() {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
    ARBEBUS_LEAVE_ALERT_TASK
  );

  if (!alreadyStarted) return;

  await Location.stopLocationUpdatesAsync(ARBEBUS_LEAVE_ALERT_TASK);
}