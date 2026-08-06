import { useCallback, useEffect, useRef, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

interface UseAsyncOptions<T> {
  executeOnMount?: boolean;
  initialData?: T | null;
}

export function useAsync<T>(
  action: () => Promise<T>,
  options: UseAsyncOptions<T> = {},
): {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  run: () => Promise<T | null>;
  reset: () => void;
} {
  const [state, setState] = useState<AsyncState<T>>({
    data: options.initialData ?? null,
    error: null,
    isLoading: false,
  });
  const actionRef = useRef(action);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  const run = useCallback(async () => {
    setState((current) => ({ ...current, error: null, isLoading: true }));

    try {
      const result = await actionRef.current();
      setState({ data: result, error: null, isLoading: false });
      return result;
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error("Unknown error");
      setState({ data: null, error: normalizedError, isLoading: false });
      return null;
    }
  }, []);

  useEffect(() => {
    if (options.executeOnMount !== false) {
      void run();
    }
  }, [options.executeOnMount, run]);

  const reset = useCallback(() => {
    setState({ data: options.initialData ?? null, error: null, isLoading: false });
  }, [options.initialData]);

  return {
    ...state,
    run,
    reset,
  };
}
