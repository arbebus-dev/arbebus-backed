import { useEffect, useRef, useState } from "react";
import { PlaceResult, searchPlaces } from "../services/transitApi";

const SEARCH_DEBOUNCE_MS = 420;
const MIN_QUERY_LENGTH = 2;

export function useSearchPlaces(query: string) {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const cleanQuery = query.trim();
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (cleanQuery.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const data = await searchPlaces(cleanQuery);

        if (!cancelled && requestId === requestIdRef.current) {
          setResults(data);
        }
      } catch {
        if (!cancelled && requestId === requestIdRef.current) {
          setResults([]);
        }
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

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
