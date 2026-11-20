import type { QueryClient } from '@tanstack/react-query';

type Id = string | undefined;

/**
 * Every react-query key in the app. Call sites and invalidations both go
 * through here so a key can't be misspelled on one side only.
 */
export const qk = {
  markets: {
    list: () => ['markets'] as const,
    byFeed: (feedId: number | undefined) => ['feed-markets', feedId] as const,
  },
  market: {
    detail: (id: Id) => ['market', id] as const,
    state: (id: Id) => ['state', id] as const,
    price: (id: Id) => ['price', id] as const,
    fee: (id: Id) => ['fee', id] as const,
    position: (id: Id, address: Id) => ['position', id, address] as const,
  },
  perpetuals: {
    list: () => ['perpetuals'] as const,
  },
  perpetual: {
    detail: (id: Id) => ['perpetual', id] as const,
    state: (id: Id) => ['perpetualState', id] as const,
    price: (id: Id) => ['perpetualPrice', id] as const,
    fee: (id: Id) => ['perpetualFee', id] as const,
    position: (id: Id, address: Id) => ['perpetualPosition', id, address] as const,
  },
  wallet: {
    balance: (address: Id) => ['walletBalance', address] as const,
  },
  portfolio: {
    marketRow: (id: Id, address: Id) => ['portfolio-row', id, address] as const,
    perpetualRow: (id: Id, address: Id) => ['portfolio-perpetual-row', id, address] as const,
  },
  admin: {
    overview: (key: string) => ['admin', 'overview', key] as const,
    feeRevenue: (key: string) => ['admin', 'fee-revenue', key] as const,
    treasury: (key: string) => ['admin', 'treasury', key] as const,
    wallets: (key: string) => ['admin', 'wallets', key] as const,
    network: (key: string) => ['admin', 'network', key] as const,
    settlementChecks: (key: string) => ['admin', 'settlement-checks', key] as const,
  },
};

/** The one place that decides what a trade (buy/redeem) makes stale: the position, pool state, price, the wallet's balance and its portfolio row. */
export function invalidateAfterTrade(
  queryClient: QueryClient,
  { kind, id, address }: { kind: 'market' | 'perpetual'; id: string; address?: string },
): Promise<unknown> {
  const k = kind === 'market' ? qk.market : qk.perpetual;
  const keys: readonly (readonly unknown[])[] = [
    k.state(id),
    k.price(id),
    ...(address
      ? [
          k.position(id, address),
          qk.wallet.balance(address),
          kind === 'market' ? qk.portfolio.marketRow(id, address) : qk.portfolio.perpetualRow(id, address),
        ]
      : []),
  ];
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
