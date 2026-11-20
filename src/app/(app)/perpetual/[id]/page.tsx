'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OddsBar } from '@/components/odds-bar';
import { PerpetualTradeCard } from '@/components/perpetual-trade-card';
import { stroopsToXlm, statusLabel, centsToUsd } from '@/lib/format';

export default function PerpetualDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: perpetual } = useQuery({
    queryKey: ['perpetual', id],
    queryFn: () => api.getPerpetual(id),
  });
  const { data: price } = useQuery({
    queryKey: ['perpetualPrice', id],
    queryFn: () => api.getPerpetualPrice(id),
    refetchInterval: 15_000,
    enabled: perpetual?.status === 'watching',
  });
  const { data: state } = useQuery({
    queryKey: ['perpetualState', id],
    queryFn: () => api.getPerpetualState(id),
    refetchInterval: perpetual?.status === 'watching' ? 15_000 : false,
  });
  const { data: fee } = useQuery({
    queryKey: ['perpetualFee', id],
    queryFn: () => api.getPerpetualFee(id),
    enabled: perpetual?.status === 'watching',
    refetchInterval: 15_000,
  });

  if (!perpetual) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  const isOpen = perpetual.status === 'watching';
  const hasCheckpoint = !!state && state.lastPriceAt !== '0';

  return (
    <div className="grid grid-cols-1 gap-6 pb-56 lg:grid-cols-3 lg:pb-0">
      <div className="lg:col-span-2">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">XLM/USD</span>
          <Badge tone={isOpen ? 'accent' : 'neutral'}>{statusLabel(perpetual.status)}</Badge>
        </div>
        <h1 className="mb-3 text-2xl font-bold">XLM/USD perpetual</h1>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Continuous market — no expiry, no fixed settlement. Trade any time; an admin can wind it down with{' '}
          <span className="font-mono text-xs">terminate()</span>, after which every position pays 0.5 XLM per
          share.
        </p>

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
              <div className="text-[var(--faint)]">Status</div>
              <div className="font-semibold">{statusLabel(perpetual.status)}</div>
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
                <div>
                  <div className="text-[var(--faint)]">Last observed price</div>
                  <div className="font-semibold">
                    {hasCheckpoint ? centsToUsd(state.lastPriceCents) : '—'}
                  </div>
                  <div className="text-xs text-[var(--faint)]">
                    {hasCheckpoint
                      ? 'informational only — no effect on trading'
                      : 'no checkpoint recorded yet'}
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
        <PerpetualTradeCard
          perpetualId={id}
          className="max-h-[70vh] overflow-y-auto rounded-none border-0 bg-transparent shadow-none lg:max-h-none lg:overflow-visible lg:rounded-2xl lg:border lg:border-[var(--line)] lg:bg-[var(--surface)] lg:shadow-sm"
          bodyClassName="p-0 lg:p-5"
        />
      </div>
    </div>
  );
}
