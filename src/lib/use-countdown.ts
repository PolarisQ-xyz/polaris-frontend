import { useEffect, useState } from 'react';
import { formatCountdown } from '@/lib/format';

const HOUR_MS = 3_600_000;

/**
 * Live "closes in …" label. Re-renders on a timer so the text moves without
 * waiting for a React Query refetch: every second in the final hour, every
 * minute before that. Pass `undefined` for a market that isn't open — no
 * timer runs, and the returned string is empty. The timer also stops once
 * the expiry has passed.
 */
export function useCountdown(expiryUnixSecs: number | undefined): string {
  const [, setTick] = useState(0);
  const remainingMs = expiryUnixSecs === undefined ? 0 : expiryUnixSecs * 1000 - Date.now();
  const intervalMs = remainingMs <= 0 ? null : remainingMs < HOUR_MS ? 1_000 : 60_000;

  useEffect(() => {
    if (intervalMs === null) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return expiryUnixSecs === undefined ? '' : formatCountdown(expiryUnixSecs);
}
