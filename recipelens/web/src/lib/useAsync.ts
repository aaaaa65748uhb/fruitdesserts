import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api.js';

export interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  /** True only for the very first load, so lists can show a skeleton once. */
  initializing: boolean;
  reload: () => Promise<T | null>;
  setData: (updater: T | ((current: T | null) => T)) => void;
}

/**
 * Minimal data-fetching hook: every screen gets loading / error / retry for
 * free, and no request can leave the UI stuck on a spinner.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const mounted = useRef(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      if (mounted.current) setDataState(result);
      return result;
    } catch (caught) {
      const apiError =
        caught instanceof ApiError ? caught : new ApiError(0, 'UNKNOWN', 'Something went wrong. Please try again.', { retryable: true });
      if (mounted.current) setError(apiError);
      return null;
    } finally {
      if (mounted.current) {
        setLoading(false);
        setInitializing(false);
      }
    }
  }, []);

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater: T | ((current: T | null) => T)) => {
    setDataState((current) => (typeof updater === 'function' ? (updater as (c: T | null) => T)(current) : updater));
  }, []);

  return { data, error, loading, initializing, reload: run, setData };
}

/** Tracks a one-off action (submit, delete…) with its own error + pending state. */
export function useAction<TArgs extends unknown[], TResult>(action: (...args: TArgs) => Promise<TResult>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setPending(true);
      setError(null);
      try {
        return await action(...args);
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught : new ApiError(0, 'UNKNOWN', 'Something went wrong. Please try again.', { retryable: true }),
        );
        return null;
      } finally {
        setPending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return { run, pending, error, clearError: () => setError(null) };
}
