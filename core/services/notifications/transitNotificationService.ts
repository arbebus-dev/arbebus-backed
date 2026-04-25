import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type JourneyAlertSignal = {
  type:
    | "leave_now"
    | "board_now"
    | "get_off_soon"
    | "transfer_soon"
    | "reroute_needed";
  priority: "medium" | "high";
  title: string;
  message: string;
};

type AlertDispatchOptions = {
  apiBase: string;
  deviceId: string;
  journeyKey: string;
  alerts: JourneyAlertSignal[];
};

type RegisteredPushState = {
  attempted: boolean;
  token: string | null;
};

const sentAlertMemory = new Map<string, number>();
const registeredPushState: RegisteredPushState = {
  attempted: false,
  token: null,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId(): string | undefined {
  const fromExpoConfig =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants as any)?.easConfig?.projectId;

  return fromExpoConfig;
}

export async function ensureNotificationChannelAsync() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("transit-alerts", {
    name: "Transit alerts",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 200, 250],
    lockscreenVisibility:
      Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: "default",
  });
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    await ensureNotificationChannelAsync();

    const currentPermissions = await Notifications.getPermissionsAsync();
    let finalStatus = currentPermissions.status;

    if (finalStatus !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    const projectId = getProjectId();
    const pushToken = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    return pushToken?.data || null;
  } catch (error) {
    console.log("registerForPushNotificationsAsync error:", error);
    return null;
  }
}

export async function ensurePushRegistrationAsync(
  apiBase: string,
  deviceId: string
): Promise<string | null> {
  if (registeredPushState.attempted) {
    return registeredPushState.token;
  }

  registeredPushState.attempted = true;

  try {
    const token = await registerForPushNotificationsAsync();
    registeredPushState.token = token;

    if (!token) {
      return null;
    }

    await fetch(`${apiBase}/push/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceId,
        expoPushToken: token,
        platform: Platform.OS,
      }),
    }).catch((error) => {
      console.log("push/register failed:", error);
    });

    return token;
  } catch (error) {
    console.log("ensurePushRegistrationAsync error:", error);
    return null;
  }
}

function buildAlertFingerprint(journeyKey: string, alert: JourneyAlertSignal) {
  return [
    journeyKey,
    alert.type,
    alert.priority,
    alert.title,
    alert.message,
  ].join("|");
}

function getDedupWindowMs(alert: JourneyAlertSignal) {
  switch (alert.type) {
    case "board_now":
      return 60 * 1000;
    case "get_off_soon":
      return 90 * 1000;
    case "transfer_soon":
      return 90 * 1000;
    case "reroute_needed":
      return 120 * 1000;
    case "leave_now":
    default:
      return 4 * 60 * 1000;
  }
}

export async function dispatchTransitAlertsAsync({
  apiBase,
  deviceId,
  journeyKey,
  alerts,
}: AlertDispatchOptions) {
  if (!alerts.length) return;

  await ensurePushRegistrationAsync(apiBase, deviceId);
  await ensureNotificationChannelAsync();

  const now = Date.now();

  for (const alert of alerts) {
    const fingerprint = buildAlertFingerprint(journeyKey, alert);
    const lastSentAt = sentAlertMemory.get(fingerprint) || 0;
    const dedupWindowMs = getDedupWindowMs(alert);

    if (now - lastSentAt < dedupWindowMs) {
      continue;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: alert.title,
          body: alert.message,
          sound: "default",
          data: {
            type: alert.type,
            journeyKey,
            deviceId,
          },
        },
        trigger: null,
      });

      sentAlertMemory.set(fingerprint, now);
    } catch (error) {
      console.log("dispatchTransitAlertsAsync schedule error:", error);
    }
  }
}

export function buildJourneyKey(params: {
  pickupId?: string | null;
  destinationId?: string | null;
  routeId?: string | null;
}) {
  return [
    params.pickupId || "pickup",
    params.destinationId || "destination",
    params.routeId || "route",
  ].join(":");
}