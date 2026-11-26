'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { centsToUsd, statusLabel } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import { useWatchlist } from '@/lib/watchlist';
import { cn } from '@/lib/cn';

function statusTone(status: string): 'yes' | 'no' | 'warn' | 'neutral' {
  if (status === 'settled') return 'yes';
  if (status === 'cancelled') return 'no';
  if (status === 'pending') return 'warn';
  return 'neutral';
}

/**
 * Formats a bps change into a signed percentage string. Sub-1% moves (the
 * common case on a 1h lookback) keep one decimal place so a real 40 bps
 * move reads as "+0.4%" instead of collapsing to "+0%"; at/above 1% we
 * round to a whole percent to keep the column compact.
 */
export function formatBpsChange(yesBpsChange: number): string {
  const pct = yesBpsChange / 100;
  const sign = pct > 0 ? '+' : '';
  if (Math.abs(pct) < 1) {
    return `${sign}${pct.toFixed(1)}%`;
  }
  return `${sign}${Math.round(pct)}%`;
}

/**
 * `null` (never `0`) means "no history to compare against yet" — a market
 * younger than the backend's snapshot window, or the snapshot service
 * hasn't run long enough since a fresh deploy. Rendered as a plain dash,
 * not a fabricated "+0%", so it reads as "not enough data" rather than
 * "hasn't moved" — see `polaris-oracle`'s `GET /markets/:id/price` doc
 * comment for why that distinction is made server-side too.
 */
function ChgCell({ yesBpsChange }: { yesBpsChange: number | null | undefined }) {
  if (yesBpsChange === null || yesBpsChange === undefined) {
    return <span className="text-[var(--faint)]">—</span>;
  }
  const color =
    yesBpsChange > 0 ? 'var(--yes)' : yesBpsChange < 0 ? 'var(--no)' : 'var(--muted)';
  return <span style={{ color }}>{formatBpsChange(yesBpsChange)}</span>;
}

/**
 * A dense, ticker-style row rather than the old card grid — one line per
 * market, right-aligned tabular odds instead of a full odds bar, so a
 * growing list of markets scans like a watchlist instead of a stack of
 * tiles. "Chg" is the YES odds' real move against `polaris-oracle`'s
 * recorded history (default a 1h lookback) — see `ChgCell`'s doc comment
 * for the null-vs-zero distinction.
 */
function StarButton({ watched, onToggle, label }: { watched: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={watched}
      aria-label={watched ? `Remove ${label} from watchlist` : `Add ${label} to watchlist`}
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-lg leading-none transition-colors hover:bg-[var(--surface-2)]',
        watched ? 'text-[var(--warn)]' : 'text-[var(--faint)]',
      )}
    >
      {watched ? '★' : '☆'}
    </button>
  );
}

function MarketRow({
  contractId,
  watched,
  onToggleWatch,
}: {
  contractId: string;
  watched: boolean;
  onToggleWatch: () => void;
}) {
  const { data: market } = useQuery({
    queryKey: qk.market.detail(contractId),
    queryFn: () => api.getMarket(contractId),
  });
  const { data: price } = useQuery({
    queryKey: qk.market.price(contractId),
    queryFn: () => api.getPrice(contractId),
    enabled: market?.status === 'watching',
    refetchInterval: 15_000,
  });

  const isOpen = market?.status === 'watching';
  const countdown = useCountdown(isOpen ? market?.expiry : undefined);

  if (!market) return null;

  const yesPct = price ? Math.round(price.yesBps / 100) : undefined;
  const noPct = price ? Math.round(price.noBps / 100) : undefined;

  return (
    <div className="flex items-center pl-2 sm:pl-3">
      <StarButton watched={watched} onToggle={onToggleWatch} label={`XLM/USD ≥ ${centsToUsd(market.strikePriceCents)}`} />
    <Link
      href={`/market/${contractId}`}
      className="grid min-w-0 flex-1 grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-x-3 px-2 py-3 transition-colors hover:bg-[var(--surface-2)] sm:gap-x-5 sm:px-3 sm:pr-5"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ background: isOpen ? 'var(--brand-gradient)' : 'var(--faint)' }}
      >
        XL
      </span>

      <span className="min-w-0">
        <span className="block truncate font-semibold">XLM/USD</span>
        <span className="block truncate text-xs text-[var(--muted)]">
          ≥ {centsToUsd(market.strikePriceCents)}
        </span>
      </span>

      <span className="text-right font-mono text-sm tabular-nums">
        {yesPct !== undefined ? (
          <span style={{ color: 'var(--yes)' }}>{yesPct}%</span>
        ) : (
          <span className="text-[var(--faint)]">—</span>
        )}
        <span className="block text-[10px] uppercase tracking-wide text-[var(--faint)]">Yes</span>
      </span>

      <span className="text-right font-mono text-sm tabular-nums">
        {noPct !== undefined ? (
          <span style={{ color: 'var(--no)' }}>{noPct}%</span>
        ) : (
          <span className="text-[var(--faint)]">—</span>
        )}
        <span className="block text-[10px] uppercase tracking-wide text-[var(--faint)]">No</span>
      </span>

      <span className="text-right font-mono text-sm tabular-nums">
        <ChgCell yesBpsChange={price?.yesBpsChange} />
        <span className="block text-[10px] uppercase tracking-wide text-[var(--faint)]">Chg</span>
      </span>

      <span className="hidden text-right sm:block">
        <Badge tone={statusTone(market.status)}>{statusLabel(market.status)}</Badge>
        <span className="mt-1 block text-xs text-[var(--muted)]">
          {isOpen ? countdown : 'closed'}
        </span>
      </span>
    </Link>
    </div>
  );
}

type ListFilter = 'all' | 'watchlist';

/**
 * The full-list view — every market, every status. Not the primary landing
 * experience (see `(app)/page.tsx`'s curated single-market view), but nothing
 * was removed: this is the "browse everything" fallback, a watchlist-style
 * list with a localStorage-backed star per market and an All / Watchlist
 * filter (#45).
 */
export default function AllMarketsPage() {
  const {
    data: markets,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['markets'],
    queryFn: api.listMarkets,
    refetchInterval: 30_000,
  });
  const { ids: watchedIds, isWatched, toggle } = useWatchlist();
  const [filter, setFilter] = useState<ListFilter>('all');

  const visible = markets && filter === 'watchlist' ? markets.filter((m) => isWatched(m.contractId)) : markets;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">All markets</h1>
      <p className="mb-4 text-sm text-[var(--muted)]">Every XLM/USD market, open or closed.</p>

      <div className="mb-4 inline-flex rounded-lg border border-[var(--line)] p-0.5" role="group" aria-label="Filter markets">
        {(['all', 'watchlist'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
              filter === f ? 'bg-[var(--surface-2)] text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]',
            )}
          >
            {f === 'all' ? 'All' : `★ Watchlist (${watchedIds.length})`}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-[var(--muted)]">Loading markets…</p>}
      {error && (
        <p className="text-sm text-[var(--no)]">
          Couldn&rsquo;t reach the backend: {(error as Error).message}
        </p>
      )}
      {markets && markets.length === 0 && (
        <p className="text-sm text-[var(--muted)]">No markets yet — an admin can create one from /create.</p>
      )}
      {markets && markets.length > 0 && visible && visible.length === 0 && (
        <p className="text-sm text-[var(--muted)]">
          Nothing on your watchlist yet — tap the ☆ next to a market to track it.
        </p>
      )}

      {visible && visible.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex border-b border-[var(--line)] pl-2 sm:pl-3">
            <span className="w-8 shrink-0" aria-hidden="true" />
            <div className="grid min-w-0 flex-1 grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-3 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)] sm:gap-x-5 sm:px-3 sm:pr-5">
              <span className="w-8" />
              <span>Market</span>
              <span className="text-right">Yes</span>
              <span className="text-right">No</span>
              <span className="text-right">Chg</span>
              <span className="hidden text-right sm:block">Status</span>
            </div>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {visible.map((m) => (
              <MarketRow
                key={m.contractId}
                contractId={m.contractId}
                watched={isWatched(m.contractId)}
                onToggleWatch={() => toggle(m.contractId)}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
