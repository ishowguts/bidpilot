'use client';
import { useCallback, useEffect, useState } from 'react';

export interface ApiState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  reload: () => void;
}

/** Runs `load` on mount and whenever `key` changes; `reload` runs it again. */
export function useApi<T>(load: () => Promise<T>, key: string): ApiState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    load()
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(undefined);
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // `load` is a new closure on every render, so `key` names what it loads instead.
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, reload };
}
