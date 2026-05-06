import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import type {
  Coordinate,
  TransitRouteOption,
} from "../features/transit/models/transitTypes";
import { useNavigationStore } from "../state/navigationStore";

const TASK_NAME = "arbebus-background-navigation";

function toCoordinate(input: any): Coordinate | null {
  const latitude = Number(
    input?.latitude ?? input?.lat ?? input?.coordinate?.latitude,
  );
  const longitude = Number(
    input?.longitude ??
      input?.lon ??
      input?.lng ??
      input?.coordinate?.longitude,
  );
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function distanceMeters(a: Coordinate, b: Coordinate) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function ensureNotificationPermissions() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

export async function triggerLocalNavigationNotification(
  title: string,
  body: string,
) {
  const allowed = await ensureNotificationPermissions();
  if (!allowed) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      data: { source: "arbebus-navigation" },
    },
    trigger: null,
  });
}

export async function syncBackgroundNavigationTrip(
  route: TransitRouteOption | null,
) {
  if (!route) return;

  useNavigationStore.getState().setActiveTrip({
    routeId: route.id,
    alightStopName: route.alightStopName,
    alightCoordinate: toCoordinate(route.destinationStop),
    route,
  });

  try {
    const allowed = await ensureNotificationPermissions();
    if (!allowed) return;

    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== "granted") return;

    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== "granted") return;

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(
      TASK_NAME,
    ).catch(() => false);
    if (!hasStarted) {
      await Location.startLocationUpdatesAsync(TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 35,
        timeInterval: 15000,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "Arbebus navigacija aktyvi",
          notificationBody: "Sekame kelionę ir perspėsime prieš išlipimą.",
        },
        pausesUpdatesAutomatically: false,
      });
    }
  } catch {
    // Background tracking is best-effort. Active foreground navigation still works.
  }
}

export async function clearBackgroundNavigationTrip() {
  useNavigationStore.getState().clearActiveTrip();
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(
      TASK_NAME,
    ).catch(() => false);
    if (hasStarted) await Location.stopLocationUpdatesAsync(TASK_NAME);
  } catch {
    // ignore
  }
}

if (!TaskManager.isTaskDefined(TASK_NAME)) {
  TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
    const activeTrip = useNavigationStore.getState().activeTrip;
    if (error || !activeTrip?.alightCoordinate) return;

    const locations = (data as any)?.locations || [];
    const latest = locations[locations.length - 1];
    const coordinate = toCoordinate(latest?.coords);
    if (!coordinate) return;

    const distance = distanceMeters(coordinate, activeTrip.alightCoordinate);

    if (distance <= 120) {
      await triggerLocalNavigationNotification(
        "Pasiruošk išlipti",
        `Artėji prie ${activeTrip.alightStopName || "išlipimo stotelės"}.`,
      );
    }

    if (distance <= 40) {
      await triggerLocalNavigationNotification(
        "Išlipk dabar",
        activeTrip.alightStopName
          ? `Išlipk stotelėje „${activeTrip.alightStopName}“.`
          : "Atvykai į išlipimo vietą.",
      );
      await clearBackgroundNavigationTrip();
    }
  });
}
