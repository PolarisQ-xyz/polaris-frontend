'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAdminKey } from '@/lib/admin-key-provider';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { shortAddress, statusLabel, centsToUsd } from '@/lib/format';
import { qk } from '@/lib/query-keys';

/**
 * `polaris-perpetual`'s admin table — a separate page from `/admin/markets`
 * with `Checkpoint`/`Terminate` actions instead of Settle/Cancel (see
 * `polaris-oracle/README.md`'s "Perpetual markets" for why this stays its
 * own route rather than a merged list with a type badge). `Checkpoint`
 * is admin-triggered, not scheduled — nothing calls it automatically, and
 * it only succeeds if the backend has a real `price_oracle` bundle wired
 * in (`MOCK_REDSTONE_CONTRACT` configured, see that README section) —
 * otherwise it fails with a clear message, shown here like any other error.
 */
export default function AdminPerpetualsPage() {
  const { adminKey } = useAdminKey();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckpoint, setLastCheckpoint] = useState<Record<string, string>>({});

  const { data: perpetuals } = useQuery({ queryKey: qk.perpetuals.list(), queryFn: api.listPerpetuals });

  async function terminate(contractId: string) {
    setBusyId(contractId);
    setError(null);
    try {
      await api.triggerTerminate(adminKey, contractId);
      await queryClient.invalidateQueries({ queryKey: qk.perpetuals.list() });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function checkpoint(contractId: string) {
    setBusyId(contractId);
    setError(null);
    try {
      const result = await api.triggerCheckpoint(adminKey, contractId);
      setLastCheckpoint((prev) => ({ ...prev, [contractId]: centsToUsd(result.lastPriceCents) }));
      await queryClient.invalidateQueries({ queryKey: qk.perpetual.state(contractId) });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Perpetuals</h1>

      {error && <p className="mb-4 text-sm text-[var(--no)] break-all">{error}</p>}

      <div className="space-y-3">
        {perpetuals?.map((p) => (
          <Card key={p.contractId}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-[var(--faint)]">{shortAddress(p.contractId)}</div>
                <div className="text-sm font-semibold">XLM/USD perpetual</div>
                {p.lastError && <div className="mt-1 text-xs text-[var(--no)] max-w-md break-all">{p.lastError}</div>}
                {lastCheckpoint[p.contractId] && (
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Last checkpoint: {lastCheckpoint[p.contractId]}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge>{statusLabel(p.status)}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === p.contractId || p.status !== 'watching'}
                  onClick={() => checkpoint(p.contractId)}
                >
                  Checkpoint
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === p.contractId || p.status !== 'watching'}
                  onClick={() => terminate(p.contractId)}
                >
                  Terminate
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
        {perpetuals?.length === 0 && <p className="text-sm text-[var(--muted)]">No perpetuals yet.</p>}
      </div>
    </div>
  );
}
