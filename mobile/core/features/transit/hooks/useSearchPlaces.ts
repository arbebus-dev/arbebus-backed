import { useEffect, useState } from "react";
import { PlaceResult, searchPlaces } from "../services/transitApi";

export function useSearchPlaces(query: string) {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cleanQuery = query.trim();

    if (cleanQuery.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;

    async function run() {
      setLoading(true);

      try {
        const data = await searchPlaces(cleanQuery);

        if (!cancelled) {
          setResults(data);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    const timer = setTimeout(run, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return {
    results,
    loading,
  };
}