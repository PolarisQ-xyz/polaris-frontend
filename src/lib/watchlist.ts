import { useCallback, useEffect, useState } from 'react';

/** localStorage key for the market watchlist (#45): a JSON array of market contract ids. */
export const WATCHLIST_KEY = 'polaris.watchlist';

/** Storage can be unavailable or hold junk; anything unreadable is an empty watchlist. */
export function readWatchlist(storage?: Pick<Storage, 'getItem'>): string[] {
  try {
    const raw = (storage ?? window.localStorage).getItem(WATCHLIST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.filter((id): id is string => typeof id === 'string')));
  } catch {
    return [];
  }
}

export function writeWatchlist(ids: string[], storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? window.localStorage).setItem(WATCHLIST_KEY, JSON.stringify(ids));
  } catch {
    // The watchlist still works for this session.
  }
}

/** Pure toggle: returns a new list with `id` added or removed. */
export function toggleWatchlistId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export function useWatchlist() {
  // Empty on first render, restored after mount, so server and client markup match.
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(readWatchlist());
    const onStorage = (e: StorageEvent) => {
      if (e.key === WATCHLIST_KEY) setIds(readWatchlist());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    // Re-read so a toggle in another tab isn't overwritten by stale state.
    const next = toggleWatchlistId(readWatchlist(), id);
    writeWatchlist(next);
    setIds(next);
  }, []);

  const isWatched = useCallback((id: string) => ids.includes(id), [ids]);
  return { ids, isWatched, toggle };
}
