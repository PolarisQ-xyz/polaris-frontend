import { describe, expect, it } from 'vitest';
import { readWatchlist, toggleWatchlistId, WATCHLIST_KEY, writeWatchlist } from './watchlist';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('watchlist storage', () => {
  it('is empty when nothing is stored', () => {
    expect(readWatchlist(fakeStorage())).toEqual([]);
  });

  it('round-trips ids', () => {
    const storage = fakeStorage();
    writeWatchlist(['CA', 'CB'], storage);
    expect(readWatchlist(storage)).toEqual(['CA', 'CB']);
  });

  it('treats corrupt or wrongly-shaped data as empty and drops non-strings and duplicates', () => {
    expect(readWatchlist(fakeStorage({ [WATCHLIST_KEY]: '{not json' }))).toEqual([]);
    expect(readWatchlist(fakeStorage({ [WATCHLIST_KEY]: '{"a":1}' }))).toEqual([]);
    expect(readWatchlist(fakeStorage({ [WATCHLIST_KEY]: '["CA",1,null,"CA","CB"]' }))).toEqual(['CA', 'CB']);
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readWatchlist(broken)).toEqual([]);
    expect(() => writeWatchlist(['CA'], broken)).not.toThrow();
  });
});

describe('toggleWatchlistId', () => {
  it('adds a missing id and removes a present one without mutating', () => {
    const start = ['CA'];
    expect(toggleWatchlistId(start, 'CB')).toEqual(['CA', 'CB']);
    expect(toggleWatchlistId(start, 'CA')).toEqual([]);
    expect(start).toEqual(['CA']);
  });
});
