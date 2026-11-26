'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, messageFromApiError, type OnChainPerpetual, type WatchedPerpetual } from '@/lib/api';
import { useAdminKey } from '@/components/admin-key-provider';
import { Address } from '@/components/ui/address';
import { Badge } from '@/components/ui/badge';
import { shortAddress, statusLabel, centsToUsd } from '@/lib/format';
import { qk } from '@/lib/query-keys';

export default function AdminPerpetualsPage() {
  const { adminKey } = useAdminKey();
  const [rows, setRows] = useState<PerpetualRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [checkpointPrice, setCheckpointPrice] = useState('');

  const { data: perpetuals, isLoading: loadingPerpetuals } = useQuery({ queryKey: qk.perpetuals.list(), queryFn: api.listPerpetuals });

  useEffect(() => {
    void load();
  }, [load]);

  async function recordCheckpoint(contractId: string) {
    if (!adminKey) return;
    const cents = Number(checkpointPrice);
    if (!Number.isFinite(cents) || cents <= 0) {
      setActionError('Enter a positive price in cents.');
      return;
    }
    setBusyId(contractId);
    setActionError(null);
    try {
      await api.triggerTerminate(adminKey, contractId);
      await queryClient.invalidateQueries({ queryKey: qk.perpetuals.list() });
    } catch (err) {
      setActionError(messageFromApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function terminate(contractId: string) {
    if (!adminKey) return;
    setBusyId(contractId);
    setActionError(null);
    try {
      const result = await api.triggerCheckpoint(adminKey, contractId);
      setLastCheckpoint((prev) => ({ ...prev, [contractId]: centsToUsd(result.lastPriceCents) }));
      await queryClient.invalidateQueries({ queryKey: qk.perpetual.state(contractId) });
    } catch (err) {
      setActionError(messageFromApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Perpetuals</h1>
        <Button variant="outline" onClick={() => void load()} disabled={!adminKey}>
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {actionError && <p className="text-sm text-red-500">{actionError}</p>}

      <div className="space-y-3">
        {loadingPerpetuals ? (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        ) : perpetuals?.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No perpetuals found.</p>
        ) : null}
        {perpetuals?.map((p) => (
          <Card key={p.contractId}>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-[var(--faint)]">{shortAddress(p.contractId)}</div>
                <div className="text-sm font-semibold">XLM/USD perpetual</div>
                {p.lastError && (
                  <div className="mt-1 text-xs text-[var(--no)] max-w-md break-all">{p.lastError}</div>
                )}
                {lastCheckpoint[p.contractId] && (
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Last checkpoint: {lastCheckpoint[p.contractId]}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
