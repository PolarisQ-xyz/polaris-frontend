import { useQuery } from '@tanstack/react-query';
import { api, type WatchedMarket } from './api';
import { RESOLUTION_POLL_MS } from './format';
import { qk } from '@/lib/query-keys';

/**
 * Once a market resolves, finds its auto-rolled successor if one has been
 * created yet — the newest still-`'watching'` market for the same feed,
 * created after this one (see `MarketFactoryService` in polaris-oracle).
 * Shared by `TradeCard` and the embed page rather than duplicated: they
 * stay separate components (different size/redeem/fallback constraints —
 * see `TradeCard`'s own doc comment), but this lookup is identical logic
 * either way.
 */
export function useNextRound(market: WatchedMarket | undefined): WatchedMarket | undefined {
  const isOpen = market?.status === 'watching';
  const { data: feedMarkets } = useQuery({
    queryKey: qk.markets.byFeed(market?.feedId),
    queryFn: () => api.listMarketsForFeed(market!.feedId),
    enabled: !!market && !isOpen,
    refetchInterval: (query) => {
      if (!market || isOpen) return false;
      const found = query.state.data?.some((m) => m.status === 'watching' && m.createdAt > market.createdAt);
      return found ? false : RESOLUTION_POLL_MS;
    },
  });
  if (!market) return undefined;
  return feedMarkets?.find((m) => m.status === 'watching' && m.createdAt > market.createdAt);
}
