import { useEffect, useState } from "react";
import { getLiveBuses, type LiveBus as ApiLiveBus } from "../services/transitApi";
import type { LiveBus } from "../models/transitTypes";

function normalizeLiveBus(bus: ApiLiveBus, index: number): LiveBus | null {
  const latitude = Number(bus.latitude);
  const longitude = Number(bus.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const number = String(bus.route ?? bus.routeId ?? bus.vehicleLabel ?? bus.vehicleId ?? "BUS");

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

export function useLiveBuses(refreshMs = 7000) {
  const [buses, setBuses] = useState<LiveBus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const result = await getLiveBuses();
      setBuses(result.map(normalizeLiveBus).filter(Boolean) as LiveBus[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Live buses error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs]);

  return {
    buses,
    loading,
    error,
    refresh: load,
  };
}
