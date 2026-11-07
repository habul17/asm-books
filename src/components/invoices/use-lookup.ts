"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Runs `fetcher` a moment after the user stops typing and keeps only the
 * newest answer, so slow replies never overwrite newer ones.
 */
export function useLookup<T>(query: string, fetcher: (q: string) => Promise<T[]>, { minLength = 1, delay = 200 } = {}) {
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    const q = query.trim();
    const id = ++latest.current;
    if (q.length < minLength) {
      const clear = setTimeout(() => {
        if (id === latest.current) {
          setResults([]);
          setLoading(false);
        }
      }, 0);
      return () => clearTimeout(clear);
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await fetcherRef.current(q);
        if (id === latest.current) setResults(rows);
      } catch {
        if (id === latest.current) setResults([]);
      } finally {
        if (id === latest.current) setLoading(false);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [query, minLength, delay]);

  return { results, loading };
}
