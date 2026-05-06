import { useCallback, useEffect, useRef, useState } from "react";
import { getLiveBuses, type LiveBus as ApiLiveBus } from "../services/transitApi";
import type { LiveBus } from "../models/transitTypes";

function normalizeLiveBus(bus: ApiLiveBus, index: number): LiveBus | null {
  const latitude = Number((bus as any).latitude ?? (bus as any).lat ?? (bus as any).coordinate?.latitude);
  const longitude = Number((bus as any).longitude ?? (bus as any).lon ?? (bus as any).lng ?? (bus as any).coordinate?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const number = String((bus as any).number ?? bus.route ?? bus.routeId ?? (bus as any).routeNumber ?? bus.vehicleLabel ?? bus.vehicleId ?? "BUS");

  return {
    id: String(bus.id ?? bus.vehicleId ?? index),
    number,
    route: bus.route,
    routeId: bus.routeId,
    vehicleId: bus.vehicleId,
    vehicleLabel: bus.vehicleLabel,
    latitude,
    longitude,
    coordinate: { latitude, longitude },
    speedKph: bus.speedKph,
    bearing: bus.bearing,
    heading: bus.heading,
    tripStart: bus.tripStart,
    delaySeconds: bus.delaySeconds,
    directionName: bus.directionName,
    fetchedAt: bus.fetchedAt,
  };
}

function busesSnapshot(buses: LiveBus[]) {
  return buses
    .map((bus) => {
      const id = String(bus.vehicleId ?? bus.id ?? bus.vehicleLabel ?? "");
      const route = String(bus.routeId ?? bus.route ?? bus.number ?? "");
      const lat = Number(bus.latitude ?? bus.coordinate?.latitude ?? 0).toFixed(5);
      const lon = Number(bus.longitude ?? bus.coordinate?.longitude ?? 0).toFixed(5);
      const heading = Math.round(Number(bus.heading ?? bus.bearing ?? 0) / 5) * 5;
      return `${id}:${route}:${lat}:${lon}:${heading}`;
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

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const result = await getLiveBuses();
      const normalized = result.map(normalizeLiveBus).filter(Boolean) as LiveBus[];
      const nextSnapshot = busesSnapshot(normalized);

      if (!mountedRef.current) return;

      if (nextSnapshot !== lastSnapshotRef.current) {
        lastSnapshotRef.current = nextSnapshot;
        setBuses(normalized);
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
