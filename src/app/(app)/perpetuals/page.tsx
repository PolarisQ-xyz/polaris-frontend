'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OddsBar } from '@/components/odds-bar';
import { statusLabel } from '@/lib/format';
import { qk } from '@/lib/query-keys';

function PerpetualCard({ contractId }: { contractId: string }) {
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

  return (
    <Link href={`/perpetual/${contractId}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardBody>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">XLM/USD</span>
            <Badge tone={perpetual.status === 'watching' ? 'accent' : 'neutral'}>
              {statusLabel(perpetual.status)}
            </Badge>
          </div>
          <h3 className="mb-3 text-lg font-semibold">XLM/USD perpetual</h3>
          {price ? (
            <OddsBar yesBps={price.yesBps} noBps={price.noBps} />
          ) : (
            <div className="h-2 w-full rounded-full bg-[var(--surface-2)]" />
          )}
          <div className="mt-3 text-xs text-[var(--muted)]">
            {perpetual.status === 'watching' ? 'continuous — no expiry' : 'terminated'}
          </div>
        </CardBody>
      </Card>
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
  const { data: perpetuals, isLoading, error } = useQuery({
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
      {error && <p className="text-sm text-[var(--no)]">Couldn&rsquo;t reach the backend: {(error as Error).message}</p>}
      {perpetuals && perpetuals.length === 0 && (
        <p className="text-sm text-[var(--muted)]">No perpetuals yet — an admin can create one.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {perpetuals?.map((p) => (
          <PerpetualCard key={p.contractId} contractId={p.contractId} />
        ))}
      </div>
    </div>
  );
}
