'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OddsBar } from '@/components/odds-bar';
import { TradeCard } from '@/components/trade-card';
import { centsToUsd, statusLabel } from '@/lib/format';
import { rankMarkets } from '@/lib/rank-markets';
import { qk } from '@/lib/query-keys';
import { useCountdown } from '@/lib/use-countdown';

/**
 * The primary landing experience: one open market, featured full-width,
 * tradeable without leaving this page — not a grid of everything. Ranked by
 * `rankMarkets` (soonest-to-expire first for now; see that file's doc
 * comment for why). The full grid still exists at `/markets`, linked from
 * here, not deleted.
 */
export default function HomePage() {
  const {
    data: markets,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['markets'],
    queryFn: api.listMarkets,
    refetchInterval: 30_000,
  });
  const [featuredIndex, setFeaturedIndex] = useState(0);

  const ranked = markets ? rankMarkets(markets) : [];
  const featured = ranked.length > 0 ? ranked[featuredIndex % ranked.length] : null;
  const countdown = useCountdown(featured?.status === 'watching' ? featured.expiry : undefined);

  const { data: price } = useQuery({
    queryKey: qk.market.price(featured?.contractId),
    queryFn: () => api.getPrice(featured!.contractId),
    enabled: !!featured,
    refetchInterval: 15_000,
  });

  const { data: ticker } = useQuery({
    queryKey: ['ticker', featured?.contractId],
    queryFn: () => api.getTickerPrice(featured!.contractId),
    enabled: !!featured,
    refetchInterval: 15_000,
  });

  if (isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading markets…</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-[var(--no)]">Couldn&rsquo;t reach the backend: {(error as Error).message}</p>
    );
  }
  if (!featured) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold">No open markets right now</h1>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Nothing&rsquo;s currently taking bets. Check what&rsquo;s already settled, or create a new one.
        </p>
        <Link href="/markets" className="text-sm font-semibold text-[var(--accent-ink)] hover:underline">
          See all markets →
        </Link>
      </div>
    );
  }

  const strikeUsd = featured.strikePriceCents / 100;
  const distancePct =
    ticker && strikeUsd > 0 ? ((ticker.price - strikeUsd) / strikeUsd) * 100 : null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">XLM/USD</span>
        {ranked.length > 1 && (
          <button
            type="button"
            onClick={() => setFeaturedIndex((i) => i + 1)}
            className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Next market ({ranked.length - 1} more) →
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-3">
            <Badge>{statusLabel(featured.status)}</Badge>
          </div>
          <h1 className="mb-4 text-3xl font-bold text-balance">
            Will XLM be ≥ {centsToUsd(featured.strikePriceCents)} by expiry?
          </h1>

          <p className="mb-4 text-sm text-[var(--muted)]">
            {ticker ? (
              <>
                XLM now: ${ticker.price.toFixed(4)}
                {distancePct !== null && (
                  <span className={distancePct >= 0 ? 'text-[var(--yes)]' : 'text-[var(--no)]'}>
                    {' '}
                    ({distancePct >= 0 ? '▲' : '▼'} {Math.abs(distancePct).toFixed(1)}%{' '}
                    {distancePct >= 0 ? 'above' : 'below'} strike)
                  </span>
                )}
              </>
            ) : (
              <>XLM now: —</>
            )}
          </p>

          {price && (
            <Card className="mb-4">
              <CardBody>
                <OddsBar yesBps={price.yesBps} noBps={price.noBps} />
              </CardBody>
            </Card>
          )}

          <p className="text-sm text-[var(--muted)]">closes in {countdown}</p>
        </div>

        <div>
          <TradeCard marketId={featured.contractId} />
        </div>
      </div>

      <div className="mt-10 border-t border-[var(--line)] pt-4 text-center">
        <Link href="/markets" className="text-sm text-[var(--muted)] hover:text-[var(--ink)] hover:underline">
          Browse all markets →
        </Link>
      </div>
    </div>
  );
}
