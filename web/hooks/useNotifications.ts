import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type UseNotificationsResult = {
  notificationsReady: boolean;
  requestNotificationsPermission: () => Promise<boolean>;
};

export function useNotifications(): UseNotificationsResult {
  const [notificationsReady, setNotificationsReady] = useState(false);

  useEffect(() => {
    const bootstrapNotifications = async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        setNotificationsReady(status === "granted");

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.HIGH,
          });
        }
      } catch (error) {
        console.log("Notification bootstrap error:", error);
        setNotificationsReady(false);
      }
    };

    bootstrapNotifications();
  }, []);

  const requestNotificationsPermission = useCallback(async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === "granted";
      setNotificationsReady(granted);
      return granted;
    } catch (error) {
      console.log("Notification request error:", error);
      setNotificationsReady(false);
      return false;
    }
  }, []);

  return {
    notificationsReady,
    requestNotificationsPermission,
  };
}