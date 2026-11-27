import { describe, expect, it } from 'vitest';
import type { WatchedMarket } from './api';
import { rankMarkets } from './rank-markets';
import { nextFeaturedId, otherRankedCount, resolveFeaturedMarket } from './featured-market';

function market(contractId: string, expiry: number, status: WatchedMarket['status'] = 'watching'): WatchedMarket {
  return {
    contractId,
    strikePriceCents: '15',
    expiry,
    gracePeriodSecs: 3600,
    feedId: 100,
    status,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('featured market tracking (#102)', () => {
  it('keeps the same contractId across two snapshots that reorder and shrink ranked', () => {
    // Snapshot 1: A soonest, then B, then C. User has moved on to B.
    const snap1 = [market('CA', 1000), market('CB', 2000), market('CC', 3000)];
    const ranked1 = rankMarkets(snap1);
    const featuredId = nextFeaturedId(ranked1, 'CA');
    expect(featuredId).toBe('CB');
    const shown1 = resolveFeaturedMarket(ranked1, snap1, featuredId, null);
    expect(shown1?.contractId).toBe('CB');

    // Snapshot 2: A settled (drops out) and two new markets appear ahead of
    // B — the index the old code used (1) now points at a different market.
    const snap2 = [
      market('CA', 1000, 'settled'),
      market('CB', 2000),
      market('CC', 3000),
      market('CD', 500),
      market('CE', 1500),
    ];
    const ranked2 = rankMarkets(snap2);
    expect(ranked2[1].contractId).not.toBe('CB');
    const shown2 = resolveFeaturedMarket(ranked2, snap2, featuredId, shown1);
    expect(shown2?.contractId).toBe('CB');
  });

  it('keeps showing a featured market that left ranked, in its closed state', () => {
    const snap1 = [market('CA', 1000), market('CB', 2000)];
    const shown1 = resolveFeaturedMarket(rankMarkets(snap1), snap1, 'CA', null);

    const snap2 = [market('CA', 1000, 'settling'), market('CB', 2000)];
    const shown2 = resolveFeaturedMarket(rankMarkets(snap2), snap2, 'CA', shown1);
    expect(shown2?.contractId).toBe('CA');
    expect(shown2?.status).toBe('settling');

    // Even if the backend stops listing it, the last snapshot is kept.
    const snap3 = [market('CB', 2000)];
    const shown3 = resolveFeaturedMarket(rankMarkets(snap3), snap3, 'CA', shown2);
    expect(shown3?.contractId).toBe('CA');
  });

  it('"Next market" advances in ranked order, wraps, and restarts when the current one left', () => {
    const ranked = rankMarkets([market('CA', 1000), market('CB', 2000), market('CC', 3000)]);
    expect(nextFeaturedId(ranked, 'CA')).toBe('CB');
    expect(nextFeaturedId(ranked, 'CB')).toBe('CC');
    expect(nextFeaturedId(ranked, 'CC')).toBe('CA');
    expect(nextFeaturedId(ranked, 'CGONE')).toBe('CA');
    expect(nextFeaturedId(ranked, null)).toBe('CA');
  });

  it('handles empty and single-market lists', () => {
    expect(resolveFeaturedMarket([], [], null, null)).toBeNull();
    expect(nextFeaturedId([], 'CA')).toBeNull();
    const single = [market('CA', 1000)];
    expect(nextFeaturedId(single, 'CA')).toBeNull();
    expect(otherRankedCount(single, 'CA')).toBe(0);
    expect(otherRankedCount(single, 'CGONE')).toBe(1);
  });

  it('features the top-ranked market before any choice is made', () => {
    const snap = [market('CB', 2000), market('CA', 1000)];
    expect(resolveFeaturedMarket(rankMarkets(snap), snap, null, null)?.contractId).toBe('CA');
  });
});
