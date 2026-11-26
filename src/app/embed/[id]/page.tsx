'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, messageFromApiError } from '@/lib/api';
import { useWallet } from '@/lib/wallet-provider';
import { callAsWallet } from '@/lib/freighter-wallet';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OddsBar } from '@/components/odds-bar';
import { AuthControls } from '@/components/auth-controls';
import { ResultReveal } from '@/components/result-reveal';
import {
  centsToUsd,
  statusLabel,
  stroopsToXlm,
  xlmToStroops,
  shortAddress,
  isPollableStatus,
  RESOLUTION_POLL_MS,
} from '@/lib/format';
import { estimateBuyOut, withSlippageTolerance } from '@/lib/amm';
import type { MarketStatus } from '@/lib/portfolio';
import { useNextRound } from '@/lib/use-next-round';
import { LogoMark } from '@/components/logo-mark';
import { invalidateAfterTrade, qk } from '@/lib/query-keys';

const SLIPPAGE_TOLERANCE_BPS = 200; // 2%

/**
 * Post a lifecycle event to the host page embedding this widget. Payloads
 * intentionally carry no wallet address, balance, or position size — only
 * the event name and, for trades, the side and tx hash. See the embed guide
 * for the documented schema.
 */
function postToHost(type: string, payload: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage({ type, ...payload }, '*');
}

/**
 * The embeddable version of the market detail page — meant to run inside a
 * third-party site's `<iframe>`, not as a standalone destination. Freighter
 * connects the same way here as anywhere else (it's a browser extension
 * talking to whichever page is focused, not tied to this app's origin the
 * way the old WebAuthn-based passkey flow was) — see this repo's README for
 * why the widget couldn't live on `polaris-oracle` instead.
 */
export default function EmbedMarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { wallet, connecting, error: walletError, freighterAvailable, connectWallet } = useWallet();
  const queryClient = useQueryClient();
  const rootRef = useRef<HTMLDivElement>(null);

  const [side, setSide] = useState<'Yes' | 'No'>('Yes');
  const [amount, setAmount] = useState('10');
  const [busy, setBusy] = useState(false);
  const [txResult, setTxResult] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  // Manual escape hatch to the email flow — shown after a live Freighter
  // attempt fails (walletError set with no wallet yet), or forced on
  // whenever this browser/webview has no Freighter extension at all.
  const [preferEmail, setPreferEmail] = useState(false);
  const showEmailFallback = !wallet && (preferEmail || freighterAvailable === false);
  // Set when the email flow "succeeds" but the session cookie can't be used
  // from inside this iframe (third-party cookies blocked/partitioned). We
  // must not show a signed-in state that can't trade — instead point the
  // user at the main app in a new tab.
  const [emailSessionBlocked, setEmailSessionBlocked] = useState(false);
  // Relative href — same origin by definition, so server and client render
  // identical HTML (no window read, no hydration mismatch) and no-JS
  // consumers still get a working link.
  const openInPolarisHref = `/market/${id}`;

  // Report the widget's content height to the host page so it can size the
  // iframe to fit — otherwise taller states (email fallback, ResultReveal,
  // multi-line errors) clip or scroll and shorter ones leave dead space.
  // Payload is intentionally just { type, height } — no wallet/position data.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof window === 'undefined' || window.parent === window) return;
    const post = () => {
      window.parent.postMessage({ type: 'polaris:resize', height: el.scrollHeight }, '*');
    };
    post();
    const observer = new ResizeObserver(post);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { data: market } = useQuery({
    queryKey: qk.market.detail(id),
    queryFn: () => api.getMarket(id),
    refetchInterval: (query) => (isPollableStatus(query.state.data?.status) ? RESOLUTION_POLL_MS : false),
  });
  const { data: price } = useQuery({
    queryKey: qk.market.price(id),
    queryFn: () => api.getPrice(id),
    refetchInterval: 15_000,
    enabled: market?.status === 'watching',
  });
  const { data: state } = useQuery({
    queryKey: qk.market.state(id),
    queryFn: () => api.getMarketState(id),
    // Was gated to only fetch while 'watching' — but the result moment
    // needs the resolved state (final price, pool balances) right after
    // expiry too, not just while trading is still open.
    refetchInterval: isPollableStatus(market?.status) ? RESOLUTION_POLL_MS : false,
  });
  const { data: fee } = useQuery({
    queryKey: qk.market.fee(id),
    queryFn: () => api.getFee(id),
    enabled: market?.status === 'watching',
    refetchInterval: 15_000,
  });
  const { data: position } = useQuery({
    queryKey: qk.market.position(id, wallet?.address),
    queryFn: () => api.getPosition(id, wallet!.address),
    enabled: !!wallet,
  });
  const nextRound = useNextRound(market);

  // polaris:ready — fired once the widget has mounted and initialized.
  useEffect(() => {
    postToHost('polaris:ready');
  }, []);

  // polaris:connected — fired once a wallet connects in the embed. Guarded
  // so it only fires on the transition into a connected state.
  const wasConnected = useRef(false);
  useEffect(() => {
    if (wallet && !wasConnected.current) {
      wasConnected.current = true;
      postToHost('polaris:connected');
    } else if (!wallet) {
      wasConnected.current = false;
    }
  }, [wallet]);

  // polaris:resolved — fired once the embedded market resolves.
  const wasResolved = useRef(false);
  useEffect(() => {
    if (market && market.status === 'resolved' && !wasResolved.current) {
      wasResolved.current = true;
      postToHost('polaris:resolved');
    }
  }, [market]);

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
    return <div className="p-4 text-sm text-[var(--muted)]">Loading…</div>;
  }

  const isOpen = market.status === 'watching';
  const pos = position ? { yes: BigInt(position.yes), no: BigInt(position.no) } : null;
  const onChainStatus = (state?.status ?? null) as MarketStatus | null;

  async function handleTrade() {
    if (!state || !fee) return;
    setTxError(null);
    setTxResult(null);

    let activeWallet = wallet;
    if (!activeWallet) {
      activeWallet = await connectWallet();
      if (!activeWallet) return;
    }

    setBusy(true);
    try {
      const stroops = xlmToStroops(amount);
      const estimate = estimateBuyOut(side, stroops, BigInt(state.poolYes), BigInt(state.poolNo), fee.feeBps);
      const minSharesOut = withSlippageTolerance(estimate, SLIPPAGE_TOLERANCE_BPS);
      const { txHash } = await callAsWallet(activeWallet, id, 'buy', {
        prediction: side,
        collateral_amount: stroops.toString(),
        min_shares_out: minSharesOut.toString(),
      });
      setTxResult(txHash);
      await invalidateAfterTrade(queryClient, { kind: 'market', id, address: activeWallet.address });
    } catch (err) {
      setTxError(messageFromApiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="p-3">
      <Card>
        <CardBody className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <a
              href={openInPolarisHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--fg)]"
            >
              <LogoMark className="h-4 w-4" />
              Polaris
            </a>
            <AuthControls />
          </div>

          <div className="space-y-1">
            <h1 className="text-base font-semibold leading-snug">{market.question}</h1>
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span>{statusLabel(market.status)}</span>
              {price && <span>· {centsToUsd(price.yesCents)} Yes</span>}
            </div>
          </div>

          {state && (
            <OddsBar
              poolYes={BigInt(state.poolYes)}
              poolNo={BigInt(state.poolNo)}
            />
          )}

          {market.status === 'resolved' && state && (
            <ResultReveal
              market={market}
              state={state}
              position={pos}
              onChainStatus={onChainStatus}
            />
          )}

          {isOpen && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={side === 'Yes' ? 'primary' : 'secondary'}
                  onClick={() => setSide('Yes')}
                >
                  Yes
                </Button>
                <Button
                  variant={side === 'No' ? 'primary' : 'secondary'}
                  onClick={() => setSide('No')}
                >
                  No
                </Button>
              </div>

              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                placeholder="Amount (XLM)"
              />

              {payoutPreview && (
                <p className="text-xs text-[var(--muted)]">
                  Potential payout: {payoutPreview} XLM
                </p>
              )}

              {wallet ? (
                <Button onClick={handleTrade} disabled={busy} className="w-full">
                  {busy ? 'Trading…' : `Buy ${side}`}
                </Button>
              ) : showEmailFallback ? (
                <div className="space-y-2">
                  <AuthControls />
                  {emailSessionBlocked && (
                    <p className="text-xs text-[var(--muted)]">
                      Your browser blocked the session cookie inside this embed.{' '}
                      <a
                        href={openInPolarisHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Open in Polaris
                      </a>{' '}
                      to trade.
                    </p>
                  )}
                </div>
              ) : (
                <Button onClick={handleTrade} disabled={busy || connecting} className="w-full">
                  {connecting ? 'Connecting…' : 'Connect wallet'}
                </Button>
              )}

              {walletError && !wallet && (
                <p className="text-xs text-[var(--danger)]">{walletError}</p>
              )}
              {txError && <p className="text-xs text-[var(--danger)]">{txError}</p>}
              {txResult && (
                <p className="text-xs text-[var(--muted)]">
                  Trade submitted: {shortAddress(txResult)}
                </p>
              )}
            </div>
          )}

          {nextRound && (
            <p className="text-xs text-[var(--muted)]">
              Next round opens {nextRound.label}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
