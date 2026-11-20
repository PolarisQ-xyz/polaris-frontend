'use client';

import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OddsBar } from '@/components/odds-bar';
import { EmbedCodeButton } from '@/components/embed-code-button';
import { TradeCard } from '@/components/trade-card';
import {
  centsToUsd,
  formatCountdown,
  statusLabel,
  stroopsToXlm,
  isPollableStatus,
  RESOLUTION_POLL_MS,
} from '@/lib/format';

export default function MarketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // Carried by ResultReveal's "Next round is live" link when this market is
  // a resolved predecessor's auto-rolled successor — see TradeCard's
  // `rolloverFromMarketId` doc comment.
  const rolloverFrom = useSearchParams().get('rolloverFrom') ?? undefined;

  const { data: market } = useQuery({
    queryKey: ['market', id],
    queryFn: () => api.getMarket(id),
    refetchInterval: (query) => (isPollableStatus(query.state.data?.status) ? RESOLUTION_POLL_MS : false),
  });
  const { data: price } = useQuery({
    queryKey: ['price', id],
    queryFn: () => api.getPrice(id),
    refetchInterval: 15_000,
    enabled: market?.status === 'watching',
  });
  const { data: state } = useQuery({
    queryKey: ['state', id],
    queryFn: () => api.getMarketState(id),
    refetchInterval: isPollableStatus(market?.status) ? RESOLUTION_POLL_MS : false,
  });
  const { data: fee } = useQuery({
    queryKey: ['fee', id],
    queryFn: () => api.getFee(id),
    enabled: market?.status === 'watching',
    refetchInterval: 15_000,
  });

  if (!market) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  const isOpen = market.status === 'watching';

  return (
    <div className="grid grid-cols-1 gap-6 pb-56 lg:grid-cols-3 lg:pb-0">
      <div className="lg:col-span-2">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">XLM/USD</span>
          <Badge>{statusLabel(market.status)}</Badge>
        </div>
        <h1 className="mb-3 text-2xl font-bold">
          Will XLM be ≥ {centsToUsd(market.strikePriceCents)} by expiry?
        </h1>

        <div className="mb-4">
          <EmbedCodeButton contractId={id} />
        </div>

        {price && (
          <Card className="mb-4">
            <CardBody>
              <OddsBar yesBps={price.yesBps} noBps={price.noBps} />
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <div className="text-[var(--faint)]">Strike</div>
              <div className="font-semibold">{centsToUsd(market.strikePriceCents)}</div>
            </div>
            <div>
              <div className="text-[var(--faint)]">Status</div>
              <div className="font-semibold">
                {isOpen ? formatCountdown(market.expiry) : statusLabel(market.status)}
              </div>
            </div>
            {state && (
              <>
                <div>
                  <div className="text-[var(--faint)]">Pool (YES/NO)</div>
                  <div className="font-semibold">
                    {stroopsToXlm(state.poolYes)} / {stroopsToXlm(state.poolNo)}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--faint)]">Fee now</div>
                  <div className="font-semibold">{fee ? `${(fee.feeBps / 100).toFixed(2)}%` : '…'}</div>
                  <div className="text-xs text-[var(--faint)]">
                    {(state.baseFeeBps / 100).toFixed(2)}% → {(state.minFeeBps / 100).toFixed(2)}% as volume
                    grows
                  </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] bg-[var(--bg)] px-4 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)] lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <TradeCard
          marketId={id}
          rolloverFromMarketId={rolloverFrom}
          className="max-h-[70vh] overflow-y-auto rounded-none border-0 bg-transparent shadow-none lg:max-h-none lg:overflow-visible lg:rounded-2xl lg:border lg:border-[var(--line)] lg:bg-[var(--surface)] lg:shadow-sm"
          bodyClassName="p-0 lg:p-5"
        />
      </div>
    </div>
  );
}
