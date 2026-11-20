'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAdminKey } from '@/lib/admin-key-provider';
import { Card, CardBody } from '@/components/ui/card';
import { BarList } from '@/components/admin/bar-list';
import { stroopsToXlm, shortAddress } from '@/lib/format';

export default function AdminFeeRevenuePage() {
  const { adminKey } = useAdminKey();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'fee-revenue', adminKey],
    queryFn: () => api.getAdminFeeRevenue(adminKey),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Fee Revenue</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Estimated, not a ledger truth — captured live per trade (the contract&apos;s fee curve depends on a
        market&apos;s pool state at the moment of the trade, which isn&apos;t recoverable after the fact).
        Counts only <code className="text-xs">buy</code>/<code className="text-xs">sell</code> — the only two
        actions that pay a fee.
      </p>

      <Card className="mb-6">
        <CardBody>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">
            Total (estimated), {data.sampleSize} trade{data.sampleSize === 1 ? '' : 's'}
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{stroopsToXlm(data.totalStroops)} XLM</div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold">By market</h2>
          <BarList
            items={data.byMarket.map((m) => ({
              label: shortAddress(m.contractId),
              value: Number(stroopsToXlm(m.stroops, 7)),
              formattedValue: `${stroopsToXlm(m.stroops)} XLM`,
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );
}
