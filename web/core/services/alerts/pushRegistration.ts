import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { API_BASE } from "../../../constants/api";

type RegisteredPushDevice = {
  deviceId: string;
  expoPushToken: string;
};

function getProjectId() {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    null
  );
}

async function getStableDeviceId(expoPushToken: string) {
  try {
    if (Platform.OS === "ios") {
      const iosId = await Application.getIosIdForVendorAsync();
      if (iosId) return iosId;
    }

    if (Application.applicationId) {
      return Application.applicationId;
    }

    return expoPushToken;
  } catch {
    return expoPushToken;
  }
}

export async function registerDeviceForBackendPush(): Promise<RegisteredPushDevice | null> {
  if (!Device.isDevice) {
    return null;
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId = getProjectId();

  if (!projectId) {
    throw new Error("Missing EAS projectId for Expo push token");
  }

  const expoPushToken = (
    await Notifications.getExpoPushTokenAsync({
      projectId,
    })
  ).data;

  const deviceId = await getStableDeviceId(expoPushToken);

  const response = await fetch(`${API_BASE}/push/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      deviceId,
      expoPushToken,
      platform: Platform.OS,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Push register failed: ${response.status} ${text}`);
  }

  return {
    deviceId,
    expoPushToken,
  };
}