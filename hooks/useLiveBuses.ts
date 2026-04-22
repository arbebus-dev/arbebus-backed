import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../constants/api";
import { LiveBus } from "../types/home";

const STORAGE_KEYS = {
  liveBuses: "arbebus_live_buses",
  lastUpdate: "arbebus_last_update",
};

const FETCH_INTERVAL = 12000;
const MAX_CACHE_AGE_MS = 2 * 60 * 1000;

type RawBus = Partial<LiveBus> & {
  coordinate?: {
    latitude?: number;
    longitude?: number;
  };
};

type Params = {
  initialDataLoaded: boolean;
  isPro: boolean;
  delayAlertsEnabled: boolean;
  notificationsReady: boolean;
  selectedBus: LiveBus | null;
  onSelectedBusUpdated?: (bus: LiveBus | null) => void;
};

function normalizeBus(raw: RawBus): LiveBus | null {
  const latitude = raw.coordinate?.latitude ?? raw.latitude;
  const longitude = raw.coordinate?.longitude ?? raw.longitude;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    typeof raw.id !== "string"
  ) {
    return null;
  }

  return {
    id: raw.id,
    type: raw.type || "bus",
    number: raw.number || raw.vehicleLabel || "?",
    vehicleLabel: raw.vehicleLabel || raw.number || "?",
    latitude: Number(latitude),
    longitude: Number(longitude),
    coordinate: {
      latitude: Number(latitude),
      longitude: Number(longitude),
    },
    speed: Number(raw.speed || 0),
    bearing: Number(raw.bearing || 0),
    heading: Number(raw.heading ?? raw.bearing ?? 0),
    tripStart: raw.tripStart || "",
    delaySeconds: Number(raw.delaySeconds || 0),
    directionName: raw.directionName || "",
    timestamp: Number(raw.timestamp || Date.now()),
  } as LiveBus;
}

export function useLiveBuses({
  initialDataLoaded,
  isPro,
  delayAlertsEnabled,
  notificationsReady,
  selectedBus,
  onSelectedBusUpdated,
}: Params) {
  const [liveBuses, setLiveBuses] = useState<LiveBus[]>([]);
  const [isLoadingBuses, setIsLoadingBuses] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [usedCachedData, setUsedCachedData] = useState(false);
  const [isBackendSleeping, setIsBackendSleeping] = useState(false);

  const busAnimationsRef = useRef<Record<string, any>>({});
  const isMountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncAnimationState = useCallback((nextBuses: LiveBus[]) => {
    const nextAnimations: Record<string, any> = {};

    nextBuses.forEach((bus) => {
      nextAnimations[bus.id] = busAnimationsRef.current[bus.id] || null;
    });

    busAnimationsRef.current = nextAnimations;
  }, []);

  const loadCachedBuses = useCallback(async () => {
    try {
      const [cachedLiveBuses, cachedLastUpdate] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.liveBuses),
        AsyncStorage.getItem(STORAGE_KEYS.lastUpdate),
      ]);

      if (!cachedLiveBuses || !cachedLastUpdate) return;

      const cacheAge = Math.abs(Date.now() - new Date(cachedLastUpdate).getTime());
      if (cacheAge > MAX_CACHE_AGE_MS) return;

      const parsed = JSON.parse(cachedLiveBuses);
      if (!Array.isArray(parsed)) return;

      const normalized = parsed.map(normalizeBus).filter(Boolean) as LiveBus[];
      if (!normalized.length) return;
      if (!isMountedRef.current) return;

      setLiveBuses(normalized);
      setLastUpdate(cachedLastUpdate);
      setUsedCachedData(true);
      syncAnimationState(normalized);
    } catch (error) {
      console.log("loadCachedBuses error:", error);
    }
  }, [syncAnimationState]);

  const wakeBackend = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/health`);
    } catch (error) {
      console.log("wakeBackend error:", error);
    }
  }, []);

  const maybeSendDelayNotification = useCallback(
    async (buses: LiveBus[]) => {
      if (!isPro || !delayAlertsEnabled || !notificationsReady || !selectedBus) {
        return;
      }

      const target = buses.find((bus) => bus.id === selectedBus.id);
      if (!target) return;

      if ((target.delaySeconds ?? 0) >= 180) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Delay alert",
              body: `Bus ${target.number} is delayed.`,
              sound: true,
            },
            trigger: null,
          });
        } catch (error) {
          console.log("delay notification error:", error);
        }
      }
    },
    [delayAlertsEnabled, isPro, notificationsReady, selectedBus]
  );

  const fetchLiveBuses = useCallback(async () => {
    if (!initialDataLoaded) return;

    try {
      if (isMountedRef.current) {
        setIsLoadingBuses(true);
      }

      const response = await fetch(`${API_BASE}/live-buses`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const data: RawBus[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.vehicles)
          ? payload.vehicles
          : [];

      if (!Array.isArray(data)) {
        throw new Error("Invalid /live-buses payload");
      }

      const normalized = data.map(normalizeBus).filter(Boolean) as LiveBus[];

      if (!isMountedRef.current) return;

      if (normalized.length > 0) {
        setLiveBuses(normalized);
        setLastUpdate(new Date().toISOString());
        setUsedCachedData(false);
        setIsBackendSleeping(false);
        syncAnimationState(normalized);

        await AsyncStorage.setItem(
          STORAGE_KEYS.liveBuses,
          JSON.stringify(normalized)
        );
        await AsyncStorage.setItem(
          STORAGE_KEYS.lastUpdate,
          new Date().toISOString()
        );

        if (selectedBus && onSelectedBusUpdated) {
          const updatedSelected = normalized.find((bus) => bus.id === selectedBus.id);
          if (updatedSelected) {
            onSelectedBusUpdated(updatedSelected);
          }
        }

        await maybeSendDelayNotification(normalized);
      } else {
        setIsBackendSleeping(false);
      }
    } catch (error) {
      console.log("fetchLiveBuses error:", error);

      if (isMountedRef.current) {
        setIsBackendSleeping(true);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingBuses(false);
      }
    }
  }, [
    initialDataLoaded,
    maybeSendDelayNotification,
    onSelectedBusUpdated,
    selectedBus,
    syncAnimationState,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!initialDataLoaded) return;

    void wakeBackend();
    void fetchLiveBuses();

    intervalRef.current = setInterval(() => {
      void fetchLiveBuses();
    }, FETCH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchLiveBuses, initialDataLoaded, wakeBackend]);

  return {
    liveBuses,
    isLoadingBuses,
    lastUpdate,
    usedCachedData,
    isBackendSleeping,
    busAnimationsRef,
    loadCachedBuses,
  };
}