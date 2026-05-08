import { useCallback, useEffect, useRef, useState } from "react";
import { getLiveBuses, type LiveBus as ApiLiveBus } from "../services/transitApi";
import type { LiveBus } from "../models/transitTypes";

const STALE_TIMEOUT_MS = 60_000;

function normalizeId(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeLiveBus(bus: ApiLiveBus, index: number): LiveBus | null {
  const latitude = Number(
    (bus as any).latitude ?? (bus as any).lat ?? (bus as any).coordinate?.latitude,
  );

  const longitude = Number(
    (bus as any).longitude ??
      (bus as any).lon ??
      (bus as any).lng ??
      (bus as any).coordinate?.longitude,
  );

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const number = String(
    (bus as any).number ??
      (bus as any).routeShortName ??
      (bus as any).routeLabel ??
      bus.route ??
      bus.routeId ??
      (bus as any).routeNumber ??
      bus.vehicleLabel ??
      bus.vehicleId ??
      "BUS",
  );

  const vehicleId = normalizeId(
    bus.vehicleId ?? bus.id ?? bus.vehicleLabel ?? `${number}-${index}`,
  );

  return {
    ...(bus as any),
    id: normalizeId(bus.id ?? vehicleId),
    number,
    route: bus.route ?? number,
    routeId: bus.routeId,
    vehicleId,
    vehicleLabel: bus.vehicleLabel,
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    previousLatitude: (bus as any).previousLatitude,
    previousLongitude: (bus as any).previousLongitude,
    previousCoordinate: (bus as any).previousCoordinate,
    rawLatitude: (bus as any).rawLatitude,
    rawLongitude: (bus as any).rawLongitude,
    speedKph: bus.speedKph,
    bearing: bus.bearing,
    heading: bus.heading,
    tripStart: bus.tripStart,
    tripId: (bus as any).tripId,
    delaySeconds: bus.delaySeconds,
    directionName: bus.directionName,
    timestamp: (bus as any).timestamp,
    positionTime: (bus as any).positionTime,
    stale: (bus as any).stale,
    staleSeconds: (bus as any).staleSeconds,
    snappedToShape: (bus as any).snappedToShape,
    snapDistanceMeters: (bus as any).snapDistanceMeters,
    filteredJump: (bus as any).filteredJump,
    predictedSeconds: (bus as any).predictedSeconds,
    fetchedAt: bus.fetchedAt,
  } as LiveBus;
}

function busStableKey(bus: LiveBus) {
  return normalizeId(
    bus.vehicleId ??
      bus.id ??
      bus.vehicleLabel ??
      `${bus.routeId ?? bus.route ?? bus.number}-${bus.latitude}-${bus.longitude}`,
  );
}

function mergeWithPrevious(previous: LiveBus[], next: LiveBus[]) {
  const previousByKey = new Map(previous.map((bus) => [busStableKey(bus), bus]));
  const nextKeys = new Set(next.map(busStableKey));
  const now = Date.now();

  const merged = next.map((bus) => {
    const key = busStableKey(bus);
    const old = previousByKey.get(key);
    const oldCoordinate = old?.coordinate;

    if (!old || !oldCoordinate) return bus;

    return {
      ...bus,
      previousCoordinate:
        (bus as any).previousCoordinate ??
        oldCoordinate,
      previousLatitude:
        (bus as any).previousLatitude ??
        oldCoordinate.latitude,
      previousLongitude:
        (bus as any).previousLongitude ??
        oldCoordinate.longitude,
    } as LiveBus;
  });

  for (const [key, old] of previousByKey.entries()) {
    if (nextKeys.has(key)) continue;

    const timestamp =
      Number((old as any).timestamp) > 0
        ? Number((old as any).timestamp) * 1000
        : Date.parse(String(old.fetchedAt || "")) || now;

    if (now - timestamp <= STALE_TIMEOUT_MS) {
      merged.push({
        ...old,
        stale: true,
        staleSeconds: Math.round((now - timestamp) / 1000),
      } as LiveBus);
    }
  }

  return merged;
}

function busesSnapshot(buses: LiveBus[]) {
  return buses
    .map((bus) => {
      const id = busStableKey(bus);
      const route = String(bus.routeId ?? bus.route ?? bus.number ?? "");
      const lat = Number(bus.latitude ?? bus.coordinate?.latitude ?? 0).toFixed(5);
      const lon = Number(bus.longitude ?? bus.coordinate?.longitude ?? 0).toFixed(5);
      const heading = Math.round(Number(bus.heading ?? bus.bearing ?? 0) / 5) * 5;
      const stale = (bus as any).stale ? "stale" : "live";
      return `${id}:${route}:${lat}:${lon}:${heading}:${stale}`;
    })
    .sort()
    .join("|");
}

export function useLiveBuses(refreshMs = 7000) {
  const [buses, setBuses] = useState<LiveBus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const loadingRef = useRef(false);
  const lastSnapshotRef = useRef("");
  const busesRef = useRef<LiveBus[]>([]);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const result = await getLiveBuses();
      const normalized = result.map(normalizeLiveBus).filter(Boolean) as LiveBus[];
      const merged = mergeWithPrevious(busesRef.current, normalized);
      const nextSnapshot = busesSnapshot(merged);

      if (!mountedRef.current) return;

      if (nextSnapshot !== lastSnapshotRef.current) {
        lastSnapshotRef.current = nextSnapshot;
        busesRef.current = merged;
        setBuses(merged);
      }

      setError(null);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Live buses error");
      }
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();

    const timer = setInterval(() => void load(), Math.max(5000, refreshMs));

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [load, refreshMs]);

  return {
    buses,
    loading,
    error,
    refresh: load,
  };
}
