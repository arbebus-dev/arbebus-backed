import AsyncStorage from "@react-native-async-storage/async-storage";

export type AlertCoordinate = {
  latitude: number;
  longitude: number;
};

export type ActiveLeaveAlert = {
  id: string;
  notificationId: string | null;
  busArrivalAtIso: string;
  triggerAtIso: string;
  pickupCoordinate: AlertCoordinate;
  destinationCoordinate?: AlertCoordinate | null;
  pickupLabel: string;
  destinationLabel: string;
  walkSeconds: number;
  prepSeconds: number;
  routeEtaSeconds: number;
  selectedBusId?: string | null;
  backgroundEnabled: boolean;
  updatedAtIso: string;
};

const ACTIVE_LEAVE_ALERT_STORAGE_KEY = "arbebus_active_leave_alert";

export async function saveActiveLeaveAlert(alert: ActiveLeaveAlert) {
  await AsyncStorage.setItem(
    ACTIVE_LEAVE_ALERT_STORAGE_KEY,
    JSON.stringify(alert)
  );
}

export async function getActiveLeaveAlert(): Promise<ActiveLeaveAlert | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_LEAVE_ALERT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed?.triggerAtIso || !parsed?.pickupCoordinate) {
      return null;
    }

    return parsed as ActiveLeaveAlert;
  } catch {
    return null;
  }
}

export async function clearActiveLeaveAlert() {
  await AsyncStorage.removeItem(ACTIVE_LEAVE_ALERT_STORAGE_KEY);
}