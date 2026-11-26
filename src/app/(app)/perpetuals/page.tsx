'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { statusLabel } from '@/lib/format';
import { qk } from '@/lib/query-keys';

function statusTone(status: string): 'yes' | 'no' | 'warn' | 'neutral' {
  if (status === 'watching') return 'yes';
  if (status === 'terminated') return 'no';
  return 'neutral';
}

/**
 * Same dense ticker row as `/markets` (Market | Yes | No | Status), adapted
 * for a perpetual: no strike or expiry exists, so the time metadata is
 * "continuous" while open and "terminated" once it has ended.
 *
 * There is deliberately no Chg column: `GET /perpetuals/:id/price` doesn't
 * return a historical change yet (unlike `/markets/:id/price`'s
 * `yesBpsChange`), and a fabricated "+0%" would read as "hasn't moved".
 * Add it here, mirroring `/markets`' `ChgCell`, when the backend supports it.
 */
function PerpetualRow({ contractId }: { contractId: string }) {
  const { data: perpetual } = useQuery({
    queryKey: qk.perpetual.detail(contractId),
    queryFn: () => api.getPerpetual(contractId),
  });
  const { data: price } = useQuery({
    queryKey: qk.perpetual.price(contractId),
    queryFn: () => api.getPerpetualPrice(contractId),
    enabled: perpetual?.status === 'watching',
    refetchInterval: 15_000,
  });

  if (!perpetual) return null;

  const yesPct = price ? Math.round(price.yesBps / 100) : undefined;
  const noPct = price ? Math.round(price.noBps / 100) : undefined;
  const isOpen = perpetual.status === 'watching';

  return (
    <Link
      href={`/perpetual/${contractId}`}
      className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-3 px-4 py-3 transition-colors hover:bg-[var(--surface-2)] sm:gap-x-5 sm:px-5"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ background: isOpen ? 'var(--brand-gradient)' : 'var(--faint)' }}
      >
        XL
      </span>

      <span className="min-w-0">
        <span className="block truncate font-semibold">XLM/USD</span>
        <span className="block truncate text-xs text-[var(--muted)]">Perpetual</span>
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

      <span className="hidden text-right sm:block">
        <Badge tone={statusTone(perpetual.status)}>{statusLabel(perpetual.status)}</Badge>
        <span className="mt-1 block text-xs text-[var(--muted)]">
          {isOpen ? 'continuous — no expiry' : 'terminated'}
        </span>
      </span>
    </Link>
  );
}

/**
 * `polaris-perpetual`'s own list page — a separate route from `/markets`,
 * not a merged feed with a type badge (see `polaris-oracle/README.md`'s
 * "Perpetual markets" for why: the two contracts have different enough
 * shapes that a shared schema/list would need a pile of fields meaningless
 * for one kind or the other).
 */
export default function AllPerpetualsPage() {
  const {
    data: perpetuals,
    isLoading,
    error,
  } = useQuery({
    queryKey: qk.perpetuals.list(),
    queryFn: api.listPerpetuals,
    refetchInterval: 30_000,
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Perpetuals</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Continuous XLM/USD markets — no expiry, trade any time.
      </p>

      {isLoading && <p className="text-sm text-[var(--muted)]">Loading perpetuals…</p>}
      {error && (
        <p className="text-sm text-[var(--no)]">
          Couldn&rsquo;t reach the backend: {(error as Error).message}
        </p>
      )}
      {perpetuals && perpetuals.length === 0 && (
        <p className="text-sm text-[var(--muted)]">No perpetuals yet — an admin can create one.</p>
      )}

      {perpetuals && perpetuals.length > 0 && (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 border-b border-[var(--line)] px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)] sm:gap-x-5 sm:px-5">
            <span className="w-8" />
            <span>Market</span>
            <span className="text-right">Yes</span>
            <span className="text-right">No</span>
            <span className="hidden text-right sm:block">Status</span>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {perpetuals.map((p) => (
              <PerpetualRow key={p.contractId} contractId={p.contractId} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
