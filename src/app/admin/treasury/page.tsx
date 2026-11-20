'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAdminKey } from '@/lib/admin-key-provider';
import { Card, CardBody } from '@/components/ui/card';
import { stroopsToXlm, shortAddress, formatDateTime } from '@/lib/format';

export default function AdminTreasuryPage() {
  const { adminKey } = useAdminKey();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'treasury', adminKey],
    queryFn: () => api.getAdminTreasury(adminKey),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (!data.configured) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">Treasury</h1>
        <p className="text-sm text-[var(--muted)]">VAULT_CONTRACT is not configured on this backend.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Treasury</h1>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">
              Current balance
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {stroopsToXlm(data.balanceStroops)} XLM
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">
              Lifetime deposited
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {stroopsToXlm(data.totalDepositedStroops)} XLM
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">Vault</div>
            <div className="mt-1 font-mono text-sm">{shortAddress(data.vaultContract)}</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold">Recent withdrawals</h2>
          <p className="mb-3 text-xs text-[var(--faint)]">
            Only withdrawals this backend itself made (market-factory seed funding) — deposits are made
            directly by an operator via the Stellar CLI and never touch this backend, so there&apos;s no
            deposit history here.
          </p>
          {data.recentWithdrawals.length === 0 ? (
            <p className="text-sm text-[var(--faint)]">No withdrawals logged yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recentWithdrawals.map((flow) => (
                <div
                  key={flow.id}
                  className="flex items-center justify-between border-t border-[var(--line)] py-2 text-sm first:border-t-0 first:pt-0"
                >
                  <div>
                    <div className="font-mono text-xs text-[var(--faint)]">
                      {shortAddress(flow.market_contract_id)}
                    </div>
                    <div className="text-xs text-[var(--faint)]">{formatDateTime(flow.created_at)}</div>
                  </div>
                  <div className="font-semibold tabular-nums">{stroopsToXlm(flow.amount_stroops)} XLM</div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
