import { useState, useEffect, useCallback, useRef } from 'react';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Generic hook for fetching API data.
 * @param fetchFn  Async function that returns the data
 * @param deps     Dependencies that trigger a re-fetch (like filters)
 */
export function useApi<T>(
  fetchFn: () => Promise<T>,
  deps: unknown[] = []
): ApiState<T> & { refetch: () => void } {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: true, error: null });
  const mountedRef = useRef(true);

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetchFn();
      if (mountedRef.current) setState({ data, loading: false, error: null });
    } catch (err: unknown) {
      if (mountedRef.current) {
        const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
          || (err as { message?: string })?.message
          || 'An error occurred';
        setState({ data: null, loading: false, error: msg });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    run();
    return () => { mountedRef.current = false; };
  }, [run]);

  return { ...state, refetch: run };
}
