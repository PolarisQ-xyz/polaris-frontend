'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAdminKey } from '@/lib/admin-key-provider';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { shortAddress } from '@/lib/format';
import { qk } from '@/lib/query-keys';

function ConfigRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex items-center justify-between border-t border-[var(--line)] py-2 text-sm first:border-t-0 first:pt-0">
      <div className="text-[var(--faint)]">{label}</div>
      <div className="font-mono text-xs">{value ? shortAddress(value) : <span className="text-[var(--no)]">not configured</span>}</div>
    </div>
  );
}

export default function AdminNetworkPage() {
  const { adminKey } = useAdminKey();
  const { data, isLoading, isError } = useQuery({
    queryKey: qk.admin.network(adminKey),
    queryFn: () => api.getAdminNetwork(adminKey),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Blockchain</h1>

      <Card className="mb-6">
        <CardBody className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">RPC health</div>
            <div className="mt-1 text-lg font-bold">{isError ? 'Unreachable' : data?.status}</div>
          </div>
          <Badge tone={isError ? 'no' : 'yes'}>{isError ? 'down' : 'healthy'}</Badge>
        </CardBody>
      </Card>

      {data && (
        <Card className="mb-6">
          <CardBody className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-[var(--faint)]">Latest ledger</div>
              <div className="font-semibold tabular-nums">{data.latestLedger}</div>
            </div>
            <div>
              <div className="text-[var(--faint)]">Oldest retained</div>
              <div className="font-semibold tabular-nums">{data.oldestLedger}</div>
            </div>
            <div>
              <div className="text-[var(--faint)]">Retention window</div>
              <div className="font-semibold tabular-nums">{data.ledgerRetentionWindow} ledgers</div>
            </div>
          </CardBody>
        </Card>
      )}

      {data && (
        <>
          <Card className="mb-6">
            <CardBody>
              <h2 className="mb-1 text-sm font-semibold">Keys</h2>
              <ConfigRow label="Settlement key" value={data.oraclePublicKey} />
              <ConfigRow label="Deploy key" value={data.deployerPublicKey} />
            </CardBody>
          </Card>

          <Card className="mb-6">
            <CardBody>
              <h2 className="mb-1 text-sm font-semibold">Contracts</h2>
              {Object.entries(data.contracts).map(([key, value]) => (
                <ConfigRow key={key} label={key} value={value} />
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h2 className="mb-1 text-sm font-semibold">Wasm hashes</h2>
              {Object.entries(data.wasmHashes).map(([key, value]) => (
                <ConfigRow key={key} label={key} value={value} />
              ))}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
