import { useCallback, useEffect, useState } from "react";
import type { LiveBus } from "../models/transitRoute";
import { fetchLiveBuses } from "../services/transitApi";

export function useLiveBuses(refreshMs = 10000) {
  const [buses, setBuses] = useState<LiveBus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const next = await fetchLiveBuses();
      setBuses(next);
      setLastUpdatedAt(new Date());
    } catch (refreshError) {
      console.warn("Live buses failed", refreshError);
      setError("Nepavyko gauti live autobusų");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, refreshMs);
    return () => clearInterval(id);
  }, [refresh, refreshMs]);

  return { buses, isLoading, error, lastUpdatedAt, refresh };
}
