'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { messageFromApiError } from '@/lib/api';
import { useWallet } from '@/lib/wallet-provider';
import { callAsWallet } from '@/lib/freighter-wallet';
import { stroopsToXlm, xlmToStroops } from '@/lib/format';
import { estimateBuyOut, withSlippageTolerance } from '@/lib/amm';
import { qk } from '@/lib/query-keys';

/** 2% — how much worse a fill is allowed to be than the quote at click-time before the trade reverts instead of silently eating the difference. */
export const SLIPPAGE_TOLERANCE_BPS = 200;

/** Minimal shape of the market state the buy flow needs to quote a fill. */
export type BuyFlowState = { poolYes: string; poolNo: string };

/** Minimal shape of the fee the buy flow needs to quote a fill. */
export type BuyFlowFee = { feeBps: number };

export type BuyFlowSide = 'Yes' | 'No';

/**
 * Shared buy flow used by every surface that lets a user buy a position:
 * `trade-card.tsx`, `perpetual-trade-card.tsx`, and the embed page. Owns the
 * side/amount/busy/txResult/txError state, the payout preview, the slippage
 * floor, and the connect-on-demand → estimate → `callAsWallet` → invalidate
 * sequence. Components keep their own layout and just render this state.
 */
export function useBuyFlow({
  contractId,
  kind,
  state,
  fee,
  invalidateKeys = [],
}: {
  contractId: string;
  /** Contract entrypoint to call for the buy (e.g. `'buy'`). */
  kind: string;
  state: BuyFlowState | null | undefined;
  fee: BuyFlowFee | null | undefined;
  /** Extra query keys to invalidate after a successful buy, beyond the position/price defaults. */
  invalidateKeys?: readonly unknown[][];
}) {
  const { wallet, connectWallet } = useWallet();
  const queryClient = useQueryClient();

  const [side, setSide] = useState<BuyFlowSide>('Yes');
  const [amount, setAmount] = useState('10');
  const [busy, setBusy] = useState(false);
  const [txResult, setTxResult] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const preview = useMemo(() => {
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

  const minSharesOut = useMemo(() => {
    if (!state || !fee) return null;
    try {
      const stroops = xlmToStroops(amount);
      if (stroops <= 0n) return null;
      const estimate = estimateBuyOut(side, stroops, BigInt(state.poolYes), BigInt(state.poolNo), fee.feeBps);
      return withSlippageTolerance(estimate, SLIPPAGE_TOLERANCE_BPS);
    } catch {
      return null;
    }
  }, [amount, side, state, fee]);

  async function buy(): Promise<string | null> {
    if (!state || !fee) return null;
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
      if (!activeWallet) return null; // failed/cancelled — `walletError` from context already explains why
    }

    setBusy(true);
    try {
      const stroops = xlmToStroops(amount);
      const estimate = estimateBuyOut(side, stroops, BigInt(state.poolYes), BigInt(state.poolNo), fee.feeBps);
      const floor = withSlippageTolerance(estimate, SLIPPAGE_TOLERANCE_BPS);
      const { txHash } = await callAsWallet(activeWallet, contractId, kind, {
        prediction: side,
        collateral_amount: stroops.toString(),
        min_shares_out: floor.toString(),
      });
      setTxResult(txHash);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.market.position(contractId, activeWallet.address) }),
        queryClient.invalidateQueries({ queryKey: qk.market.price(contractId) }),
        queryClient.invalidateQueries({ queryKey: qk.market.state(contractId) }),
        queryClient.invalidateQueries({ queryKey: qk.wallet.balance(activeWallet.address) }),
        queryClient.invalidateQueries({ queryKey: qk.portfolio.marketRow(contractId, activeWallet.address) }),
        ...invalidateKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ]);
      return txHash;
    } catch (err) {
      setTxError(messageFromApiError(err));
      return null;
    } finally {
      setBusy(false);
    }
  }

  return {
    side,
    setSide,
    amount,
    setAmount,
    busy,
    txResult,
    txError,
    preview,
    minSharesOut,
    buy,
  };
}
