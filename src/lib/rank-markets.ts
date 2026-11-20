import type { WatchedMarket } from './api';

/**
 * Ranks open markets for the curated single-market homepage — soonest to
 * expire first. Deliberately simple for v1: "something is always about to
 * resolve" is the pacing this creates, and it needs no data this page
 * doesn't already fetch (no volume/analytics backend yet — see the top-level
 * README's "what's left" list). Closed markets never rank; the homepage
 * only ever features something a visitor can actually trade.
 */
export function rankMarkets(markets: WatchedMarket[]): WatchedMarket[] {
  return markets.filter((m) => m.status === 'watching').sort((a, b) => a.expiry - b.expiry);
}
