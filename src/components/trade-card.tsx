'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, messageFromApiError } from '@/lib/api';
import { useWallet } from '@/lib/wallet-provider';
import { callAsWallet } from '@/lib/freighter-wallet';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ResultReveal } from '@/components/result-reveal';
import { stroopsToXlm, xlmToStroops, shortAddress, isPollableStatus, RESOLUTION_POLL_MS } from '@/lib/format';
import { redeemableValue, type MarketStatus } from '@/lib/portfolio';
import { estimateBuyOut, withSlippageTolerance } from '@/lib/amm';
import { useNextRound } from '@/lib/use-next-round';

/** 2% — how much worse a fill is allowed to be than the quote at click-time before the trade reverts instead of silently eating the difference. */
const SLIPPAGE_TOLERANCE_BPS = 200;

/**
 * The buy/redeem card — the one piece of trade UI in this app, used by both
 * the market detail page and the curated homepage's featured market.
 * Deliberately NOT forked between them: this file used to be inlined only
 * in `market/[id]/page.tsx`, and this session already caught one real bug
 * (`lib/portfolio.ts`'s stale Cancelled-payout mirror) that was exactly
 * this failure mode — a second copy of logic nobody remembers to keep in
 * sync with the first. Fully self-contained: fetches its own market/price/
 * state/fee/position data by `marketId`, so it's a true drop-in regardless
 * of what else a given page already fetched (React Query dedupes identical
 * query keys automatically, so this costs nothing extra when a page — like
 * the detail page — already has its own `useQuery(['market', id])`, etc.).
 */
export function TradeCard({
  marketId,
  className,
  bodyClassName,
  rolloverFromMarketId,
}: {
  marketId: string;
  /** Passed through to the outer `Card` — lets a caller (e.g. the detail page's mobile bottom-sheet) override the default card chrome without forking this component. */
  className?: string;
  bodyClassName?: string;
  /**
   * Set when this market was reached via a resolved predecessor's "Next
   * round is live" link (see `ResultReveal`/`useNextRound`). If the wallet
   * holds a redeemable win there, the amount field prefills with it and
   * `handleTrade` redeems the old position before buying into this one —
   * two sequential calls to the *existing* `redeem`/`buy` sponsored-call
   * paths, not a new contract entrypoint or a new backend endpoint. If the
   * redeem succeeds but the buy then fails (slippage, pool depth, this
   * market already closed), the user simply holds the redeemed collateral
   * in their own wallet — not a fund-safety issue, the same recoverable
   * failure shape `txError` already surfaces for any other failed buy.
   */
  rolloverFromMarketId?: string;
}) {
  const { wallet, connecting, error: walletError, connectWallet } = useWallet();
  const queryClient = useQueryClient();

  const [side, setSide] = useState<'Yes' | 'No'>('Yes');
  const [amount, setAmount] = useState('10');
  const [busy, setBusy] = useState(false);
  const [txResult, setTxResult] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const { data: market } = useQuery({
    queryKey: ['market', marketId],
    queryFn: () => api.getMarket(marketId),
    // Keeps polling while a resolution could still land, so a bettor sitting
    // on this card sees it happen instead of only on next page load — see
    // result-reveal.tsx for the moment this feeds.
    refetchInterval: (query) => (isPollableStatus(query.state.data?.status) ? RESOLUTION_POLL_MS : false),
  });
  const { data: state } = useQuery({
    queryKey: ['state', marketId],
    queryFn: () => api.getMarketState(marketId),
    refetchInterval: isPollableStatus(market?.status) ? RESOLUTION_POLL_MS : false,
  });
  const { data: fee } = useQuery({
    queryKey: ['fee', marketId],
    queryFn: () => api.getFee(marketId),
    enabled: market?.status === 'watching',
    refetchInterval: 15_000,
  });
  const { data: position } = useQuery({
    queryKey: ['position', marketId, wallet?.address],
    queryFn: () => api.getPosition(marketId, wallet!.address),
    enabled: !!wallet,
  });
  const nextRound = useNextRound(market);

  const { data: rolloverState } = useQuery({
    queryKey: ['state', rolloverFromMarketId],
    queryFn: () => api.getMarketState(rolloverFromMarketId!),
    enabled: !!rolloverFromMarketId,
  });
  const { data: rolloverPosition } = useQuery({
    queryKey: ['position', rolloverFromMarketId, wallet?.address],
    queryFn: () => api.getPosition(rolloverFromMarketId!, wallet!.address),
    enabled: !!rolloverFromMarketId && !!wallet,
  });
  const rolloverStatus = (rolloverState?.status ?? null) as MarketStatus | null;
  const rolloverAmount =
    rolloverStatus && rolloverStatus !== 'Open' && rolloverPosition
      ? redeemableValue(rolloverStatus, { yes: BigInt(rolloverPosition.yes), no: BigInt(rolloverPosition.no) })
      : 0n;

  // Prefill the amount field with the rollover payout exactly once — not on
  // every render, so it doesn't fight the user overwriting it afterward.
  const prefilledRollover = useRef(false);
  useEffect(() => {
    if (rolloverAmount > 0n && !prefilledRollover.current) {
      prefilledRollover.current = true;
      setAmount(stroopsToXlm(rolloverAmount));
    }
  }, [rolloverAmount]);

  const payoutPreview = useMemo(() => {
    if (!state || !fee) return null;
    try {
      const stroops = xlmToStroops(amount);
      if (stroops <= 0n) return null;
      const bonus = estimateBuyOut(side, stroops, BigInt(state.poolYes), BigInt(state.poolNo), fee.feeBps);
      return stroopsToXlm((stroops + bonus).toString());
    } catch {
      return null;
    }
  }, [amount, side, state, fee]);

  if (!market) {
    return (
      <Card className={className}>
        <CardBody className={bodyClassName}>
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </CardBody>
      </Card>
    );
  }

  const isOpen = market.status === 'watching';

  async function handleTrade() {
    if (!state || !fee) return;
    setTxError(null);
    setTxResult(null);

    // No wallet yet — the Freighter connect prompt only fires now, at the
    // moment of commit, so a visitor can pick a side, an amount, and see the
    // payout before ever touching a wallet. `connectWallet` returns the
    // fresh wallet directly rather than relying on `wallet` from context,
    // which won't reflect the new value until the next render.
    let activeWallet = wallet;
    if (!activeWallet) {
      activeWallet = await connectWallet();
      if (!activeWallet) return; // failed/cancelled — `walletError` from context already explains why
    }

    setBusy(true);
    try {
      if (rolloverFromMarketId && rolloverAmount > 0n) {
        await callAsWallet(activeWallet, rolloverFromMarketId, 'redeem', {});
        await queryClient.invalidateQueries({ queryKey: ['position', rolloverFromMarketId, activeWallet.address] });
      }

      const stroops = xlmToStroops(amount);
      const estimate = estimateBuyOut(side, stroops, BigInt(state.poolYes), BigInt(state.poolNo), fee.feeBps);
      const minSharesOut = withSlippageTolerance(estimate, SLIPPAGE_TOLERANCE_BPS);
      const { txHash } = await callAsWallet(activeWallet, marketId, 'buy', {
        prediction: side,
        collateral_amount: stroops.toString(),
        min_shares_out: minSharesOut.toString(),
      });
      setTxResult(txHash);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['position', marketId, activeWallet.address] }),
        queryClient.invalidateQueries({ queryKey: ['price', marketId] }),
      ]);
    } catch (err) {
      setTxError(messageFromApiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRedeem() {
    if (!wallet) return;
    setBusy(true);
    setTxError(null);
    setTxResult(null);
    try {
      const { txHash } = await callAsWallet(wallet, marketId, 'redeem', {});
      setTxResult(txHash);
      await queryClient.invalidateQueries({ queryKey: ['position', marketId, wallet.address] });
    } catch (err) {
      setTxError(messageFromApiError(err));
    } finally {
      setBusy(false);
    }
  }

  const pos = position ? { yes: BigInt(position.yes), no: BigInt(position.no) } : null;
  const onChainStatus = (state?.status ?? null) as MarketStatus | null;
  const canRedeem = pos && onChainStatus && onChainStatus !== 'Open' && redeemableValue(onChainStatus, pos) > 0n;

  return (
    <Card className={className}>
      <CardBody className={bodyClassName}>
        {!isOpen ? (
          <div className="space-y-3">
            {pos && (pos.yes > 0n || pos.no > 0n) && onChainStatus && onChainStatus !== 'Open' ? (
              <ResultReveal
                status={onChainStatus}
                position={pos}
                nextRoundHref={nextRound ? `/market/${nextRound.contractId}?rolloverFrom=${marketId}` : undefined}
              />
            ) : (
              <p className="text-sm text-[var(--muted)]">Trading is closed.</p>
            )}
            {canRedeem && (
              <Button className="w-full" onClick={handleRedeem} disabled={busy}>
                {busy ? 'Redeeming…' : 'Redeem'}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button variant={side === 'Yes' ? 'yes' : 'outline'} onClick={() => setSide('Yes')}>
                YES
              </Button>
              <Button variant={side === 'No' ? 'no' : 'outline'} onClick={() => setSide('No')}>
                NO
              </Button>
            </div>
            <label className="block text-xs font-medium text-[var(--muted)]">
              Amount (XLM)
              <input
                className="mt-1 h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
            </label>
            {rolloverAmount > 0n && (
              <p className="text-[11px] text-[var(--faint)]">
                Funded by your {stroopsToXlm(rolloverAmount)} XLM winnings from last round
              </p>
            )}

            <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2.5 text-sm">
              {payoutPreview ? (
                <>
                  You get <span className="font-semibold">{payoutPreview} XLM</span> if {side.toUpperCase()} wins{' '}
                  <span className="text-[var(--faint)]">(you stake {amount || '0'} XLM)</span>
                </>
              ) : (
                <span className="text-[var(--faint)]">Enter an amount to see your payout</span>
              )}
            </div>

            <Button
              className="w-full"
              variant={side === 'Yes' ? 'yes' : 'no'}
              onClick={handleTrade}
              disabled={busy || connecting || !state || !fee || !payoutPreview}
            >
              {connecting
                ? 'Confirm in Freighter…'
                : busy
                  ? wallet?.kind === 'email'
                    ? rolloverAmount > 0n
                      ? 'Rolling into this round…'
                      : 'Placing bet…'
                    : 'Confirm in Freighter…'
                  : `Buy ${side}`}
            </Button>
            {!wallet && !connecting && (
              <p className="text-center text-[11px] text-[var(--faint)]">
                Connects Freighter &mdash; sign with your own wallet, no custodial account
              </p>
            )}
          </div>
        )}

        {pos && (
          <div className="mt-4 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
            Your position: {stroopsToXlm(pos.yes)} YES / {stroopsToXlm(pos.no)} NO
          </div>
        )}
        {txResult && (
          <p className="mt-3 text-xs text-[var(--yes)]">
            Confirmed <span className="text-[var(--faint)]">— ref {shortAddress(txResult)}</span>
          </p>
        )}
        {(txError || walletError) && (
          <p className="mt-3 text-xs text-[var(--no)] break-all">{txError ?? walletError}</p>
        )}
      </CardBody>
    </Card>
  );
}
