import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useWallet } from './wallet-provider';
import { markToMarket, redeemableValue, type MarketStatus } from './portfolio';

/**
 * Total value (in stroops) of every open or redeemable position the current
 * wallet holds, across every market — same math as the portfolio page's
 * per-row value, summed. Powers the header's position pill so a signed-in
 * user can see "am I in anything, and is it worth anything" without a trip
 * to /bets. Returns `null` while still loading or with no wallet connected.
 *
 * Folds in perpetual positions alongside classic markets (see
 * `src/app/(app)/bets/page.tsx`'s `PerpetualPositionRow` for the matching
 * per-row logic and why `Terminated` reuses `redeemableValue('Cancelled',
 * ...)`), so the pill reflects *every* position the wallet holds, not just
 * classic-market ones.
 */
export function usePortfolioValue(): { total: bigint; hasPosition: boolean } | null {
  const { wallet } = useWallet();
  const { data: markets } = useQuery({ queryKey: ['markets'], queryFn: api.listMarkets, enabled: !!wallet });
  const { data: perpetuals } = useQuery({ queryKey: ['perpetuals'], queryFn: api.listPerpetuals, enabled: !!wallet });

  const marketResults = useQueries({
    queries: (markets ?? []).map((m) => ({
      queryKey: ['portfolio-row', m.contractId, wallet?.address],
      queryFn: async () => {
        const [state, position] = await Promise.all([
          api.getMarketState(m.contractId),
          api.getPosition(m.contractId, wallet!.address),
        ]);
        const pos = { yes: BigInt(position.yes), no: BigInt(position.no) };
        if (pos.yes === 0n && pos.no === 0n) return 0n;
        const status = state.status as MarketStatus;
        if (status !== 'Open') return redeemableValue(status, pos);
        const price = await api.getPrice(m.contractId);
        return markToMarket(pos, price.yesBps, price.noBps);
      },
      enabled: !!wallet,
      refetchInterval: 20_000,
    })),
  });

  const perpetualResults = useQueries({
    queries: (perpetuals ?? []).map((p) => ({
      queryKey: ['portfolio-perpetual-row', p.contractId, wallet?.address],
      queryFn: async () => {
        const [state, position] = await Promise.all([
          api.getPerpetualState(p.contractId),
          api.getPerpetualPosition(p.contractId, wallet!.address),
        ]);
        const pos = { yes: BigInt(position.yes), no: BigInt(position.no) };
        if (pos.yes === 0n && pos.no === 0n) return 0n;
        // `Terminated` pays the same 0.5-collateral-per-complementary-pair
        // formula as a classic market's `Cancelled` case — see
        // `PerpetualTradeCard`'s doc comment on `canRedeem`.
        if (state.status !== 'Open') return redeemableValue('Cancelled', pos);
        const price = await api.getPerpetualPrice(p.contractId);
        return markToMarket(pos, price.yesBps, price.noBps);
      },
      enabled: !!wallet,
      refetchInterval: 20_000,
    })),
  });

  if (!wallet || !markets || !perpetuals) return null;
  const results = [...marketResults, ...perpetualResults];
  if (results.some((r) => r.isLoading)) return null;

  const values = results.map((r) => (r.data as bigint | undefined) ?? 0n);
  const total = values.reduce((sum, v) => sum + v, 0n);
  return { total, hasPosition: values.some((v) => v > 0n) };
}
