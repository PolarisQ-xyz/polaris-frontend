'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Market } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import { centsToUsd, shortAddress } from '@/lib/format';
import { qk } from '@/lib/query-keys';

type FilterKey = 'attention' | 'open' | 'closed' | 'all';

function isTerminal(market: WatchedMarket): boolean {
  return market.status === 'settled' || market.status === 'cancelled';
}

function canSettle(market: WatchedMarket): boolean {
  return market.status === 'watching' || market.status === 'pending';
}

const FILTERS: { key: FilterKey; label: string; match: (market: WatchedMarket) => boolean }[] = [
  {
    key: 'attention',
    label: 'Needs attention',
    match: (m) => m.status === 'pending' || Boolean(m.lastError),
  },
  { key: 'open', label: 'Open', match: (m) => !isTerminal(m) },
  { key: 'closed', label: 'Closed', match: isTerminal },
  { key: 'all', label: 'All', match: () => true },
];

/** Relocated from `(app)/admin/page.tsx` verbatim (minus the admin-key input, now handled once by `admin/layout.tsx`'s gate) as part of the dashboard rebuild — see the other `admin/*` pages for what's actually new. */
export default function AdminMarketsPage() {
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterKey>('attention');

  const { data: markets, isLoading } = useQuery({ queryKey: qk.markets.list(), queryFn: api.listMarkets });

  async function act(action: 'settle' | 'cancel', contractId: string) {
    setBusyId(contractId);
    setError(null);
    try {
      if (action === 'settle') await api.triggerSettle(adminKey, contractId);
      else await api.triggerCancel(adminKey, contractId);
      await queryClient.invalidateQueries({ queryKey: qk.markets.list() });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const visibleMarkets = useMemo(() => {
    const active = FILTERS.find((entry) => entry.key === filter) ?? FILTERS[0];
    return markets?.filter(active.match) ?? [];
  }, [markets, filter]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Markets</h1>

      {error && <p className="mb-4 text-sm text-[var(--no)] break-all">{error}</p>}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filter markets">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={filter === entry.key}
            onClick={() => setFilter(entry.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-colors',
              filter === entry.key
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                : 'border-[var(--line)] text-[var(--ink-soft)] hover:bg-[var(--surface-2)]',
            )}
          >
            {entry.label}
            <span className="text-xs opacity-70">{markets?.filter(entry.match).length ?? 0}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--ink-soft)]">Loading markets…</p>
      ) : error ? (
        <p className="text-sm text-[var(--no)]">{error}</p>
      ) : visibleMarkets.length === 0 ? (
        <p className="text-sm text-[var(--ink-soft)]">No markets match this filter.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleMarkets.map((market) => (
            <li key={market.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold">{market.question}</h2>
                <Badge tone={market.lastError ? 'no' : market.status === 'pending' ? 'warn' : 'neutral'}>
                  {market.status}
                </Badge>
              </div>
              {market.lastError ? (
                <p className="mt-2 text-xs text-[var(--no)]">{market.lastError}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3">
        {visibleMarkets.map((m) => (
          <Card key={m.contractId}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-[var(--faint)]">{shortAddress(m.contractId)}</div>
                <div className="text-sm font-semibold">≥ {centsToUsd(m.strikePriceCents)}</div>
                {m.lastError && (
                  <div className="mt-1 text-xs text-[var(--no)] max-w-md break-all">{m.lastError}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge>{m.status}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === m.contractId || !canSettle(m)}
                  onClick={() => act('settle', m.contractId)}
                >
                  Settle
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === m.contractId || isTerminal(m)}
                  onClick={() => act('cancel', m.contractId)}
                >
                  Cancel
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
