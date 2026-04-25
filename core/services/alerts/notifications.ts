import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let configured = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationsReady() {
  if (!configured) {
    configured = true;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("leave-alerts", {
        name: "Leave alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 200, 250],
        sound: "default",
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  }

  const permissions = await Notifications.getPermissionsAsync();

  if (permissions.status === "granted") {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();

  return requested.status === "granted";
}

export async function scheduleLeaveAlertNotification(params: {
  triggerAt: Date;
  pickupLabel: string;
  destinationLabel: string;
}) {
  const body = `Time to leave. Head to ${params.pickupLabel} to catch your trip to ${params.destinationLabel}.`;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Arbebus Leave Alert",
      body,
      sound: "default",
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: {
        type: "leave-alert",
        pickupLabel: params.pickupLabel,
        destinationLabel: params.destinationLabel,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: params.triggerAt,
    },
  });

  return identifier;
}

export async function cancelScheduledNotification(
  notificationId: string | null | undefined
) {
  if (!notificationId) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.log("cancelScheduledNotification error:", error);
  }
}