import type { WatchedMarket } from './api';

/**
 * Featured-market selection for the homepage (#102).
 *
 * The featured market is tracked by `contractId`, never by its index in
 * `ranked`: the list is re-ranked on every 30s refetch (the soonest market
 * expires, a new one is created), and an index would silently point at a
 * different market — while the embedded TradeCard still holds the user's
 * chosen side and typed amount.
 */

/**
 * Resolve the market to feature.
 *
 * - No id chosen yet → the top-ranked market.
 * - Id still ranked → that market's fresh row.
 * - Id dropped out of `ranked` (expired/settled) → its row from the full
 *   `markets` list if present, else the last snapshot seen, so the user keeps
 *   seeing it in its closed state until they explicitly move on.
 */
export function resolveFeaturedMarket(
  ranked: WatchedMarket[],
  markets: WatchedMarket[],
  featuredId: string | null,
  lastSeen: WatchedMarket | null,
): WatchedMarket | null {
  if (featuredId === null) return ranked[0] ?? null;
  return (
    ranked.find((m) => m.contractId === featuredId) ??
    markets.find((m) => m.contractId === featuredId) ??
    (lastSeen?.contractId === featuredId ? lastSeen : null) ??
    ranked[0] ??
    null
  );
}

/**
 * The contractId "Next market" moves to: the one after `currentId` in ranked
 * order (wrapping), or the top-ranked market when the current one is no
 * longer ranked. `null` when there is nothing else to show.
 */
export function nextFeaturedId(ranked: WatchedMarket[], currentId: string | null): string | null {
  if (ranked.length === 0) return null;
  const index = currentId === null ? -1 : ranked.findIndex((m) => m.contractId === currentId);
  if (index === -1) return ranked[0].contractId;
  if (ranked.length === 1) return null;
  return ranked[(index + 1) % ranked.length].contractId;
}

/** How many *other* ranked markets "Next market" can move to. */
export function otherRankedCount(ranked: WatchedMarket[], currentId: string | null): number {
  return ranked.filter((m) => m.contractId !== currentId).length;
}
