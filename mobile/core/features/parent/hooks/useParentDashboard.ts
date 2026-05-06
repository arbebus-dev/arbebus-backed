import { useCallback, useEffect, useState } from "react";
import { fetchParentDashboard, type ParentDashboard } from "../services/parentApi";

export function useParentDashboard() {
  const [dashboard, setDashboard] = useState<ParentDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDashboard(await fetchParentDashboard());
    } catch (err: any) {
      setError(err?.message || "Nepavyko gauti tėvų skydelio");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { dashboard, loading, error, refresh };
}
