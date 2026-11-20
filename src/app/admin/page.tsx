'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAdminKey } from '@/lib/admin-key-provider';
import { Card, CardBody } from '@/components/ui/card';
import { BarList } from '@/components/admin/bar-list';
import { stroopsToXlm } from '@/lib/format';
import { qk } from '@/lib/query-keys';

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      </CardBody>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const { adminKey } = useAdminKey();
  const { data, isLoading } = useQuery({
    queryKey: qk.admin.overview(adminKey),
    queryFn: () => api.getAdminOverview(adminKey),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Overview</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Markets" value={data.totalMarkets.toString()} />
        <StatTile label="Perpetuals" value={data.totalPerpetuals.toString()} />
        <StatTile
          label="Vault balance"
          value={data.vaultBalanceStroops ? `${stroopsToXlm(data.vaultBalanceStroops)} XLM` : '—'}
        />
        <StatTile label="Wallet actions logged" value={data.totalWalletActions.toString()} />
        <StatTile
          label="Settlement checks"
          value={(
            data.settlementChecksByOutcome.ok +
            data.settlementChecksByOutcome.skipped +
            data.settlementChecksByOutcome.failed
          ).toString()}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold">Markets by status</h2>
            <BarList
              items={Object.entries(data.marketsByStatus).map(([status, count]) => ({
                label: status,
                value: count,
                formattedValue: count.toString(),
              }))}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold">Perpetuals by status</h2>
            {Object.keys(data.perpetualsByStatus).length === 0 ? (
              <p className="text-xs text-[var(--faint)]">No perpetuals yet.</p>
            ) : (
              <BarList
                items={Object.entries(data.perpetualsByStatus).map(([status, count]) => ({
                  label: status,
                  value: count,
                  formattedValue: count.toString(),
                }))}
              />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold">Settlement checks by outcome</h2>
            <BarList
              items={Object.entries(data.settlementChecksByOutcome).map(([outcome, count]) => ({
                label: outcome,
                value: count,
                formattedValue: count.toString(),
              }))}
            />
            {data.settlementChecksByOutcome.ok +
              data.settlementChecksByOutcome.skipped +
              data.settlementChecksByOutcome.failed ===
              0 && (
              <p className="mt-3 text-xs text-[var(--faint)]">
                Empty in this environment by design — see the Fraud &amp; Trust page.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
