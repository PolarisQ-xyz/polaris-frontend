import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Minimal `renderHook` (no @testing-library dependency): mounts `hook` inside
 * a fresh `QueryClientProvider` and exposes its latest return value.
 * Requires the jsdom environment (`// @vitest-environment jsdom`).
 */
export function renderHook<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = { current: undefined as T };
  function Probe() {
    result.current = hook();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(QueryClientProvider, { client }, createElement(Probe))));
  return {
    result,
    unmount: () => act(() => root.unmount()),
  };
}

/** Lets pending queries settle and re-render, polling until `check` passes or `timeoutMs` elapses. */
export async function waitFor(check: () => void, timeoutMs = 1_000): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      check();
      return;
    } catch (err) {
      if (Date.now() - start > timeoutMs) throw err;
      await act(() => new Promise((r) => setTimeout(r, 10)));
    }
  }
}

/** Advances real time inside `act` so React Query's intervals fire and re-render. */
export function sleep(ms: number): Promise<void> {
  return act(() => new Promise((r) => setTimeout(r, ms)));
}
