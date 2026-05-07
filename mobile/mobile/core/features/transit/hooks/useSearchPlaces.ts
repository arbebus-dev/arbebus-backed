import { useEffect, useMemo, useRef, useState } from "react";
import { PlaceResult, searchPlaces } from "../services/transitApi";

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const MEMORY_TTL_MS = 5 * 60 * 1000;
const STALE_RESULT_MAX_AGE_MS = 20 * 60 * 1000;
const MAX_RESULTS = 8;

type CachedSearch = {
  createdAt: number;
  results: PlaceResult[];
};

const memoryCache = new Map<string, CachedSearch>();

function cleanKey(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function getCachedResults(query: string) {
  const cached = memoryCache.get(cleanKey(query));
  if (!cached) return null;
  const age = Date.now() - cached.createdAt;
  if (age > STALE_RESULT_MAX_AGE_MS) {
    memoryCache.delete(cleanKey(query));
    return null;
  }
  return { ...cached, isFresh: age <= MEMORY_TTL_MS };
}

function setCachedResults(query: string, results: PlaceResult[]) {
  memoryCache.set(cleanKey(query), { createdAt: Date.now(), results: results.slice(0, MAX_RESULTS) });
}

export function useSearchPlaces(query: string) {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const requestIdRef = useRef(0);

  const cleanQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (cleanQuery.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      setIsStale(false);
      return;
    }

    const cached = getCachedResults(cleanQuery);
    if (cached?.results?.length) {
      setResults(cached.results.slice(0, MAX_RESULTS));
      setLoading(!cached.isFresh);
      setIsStale(!cached.isFresh);
      if (cached.isFresh) return;
    } else {
      setLoading(true);
      setIsStale(false);
    }

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const data = (await searchPlaces(cleanQuery)).slice(0, MAX_RESULTS);

        if (!cancelled && requestId === requestIdRef.current) {
          setCachedResults(cleanQuery, data);
          setResults(data);
          setIsStale(false);
        }
      } catch {
        if (!cancelled && requestId === requestIdRef.current && !cached?.results?.length) {
          setResults([]);
        }
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, cached?.results?.length ? 80 : SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cleanQuery]);

  return {
    results,
    loading,
    isStale,
  };
}
