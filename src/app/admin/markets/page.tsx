'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAdminKey } from '@/lib/admin-key-provider';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { centsToUsd, shortAddress } from '@/lib/format';
import { qk } from '@/lib/query-keys';

/** Relocated from `(app)/admin/page.tsx` verbatim (minus the admin-key input, now handled once by `admin/layout.tsx`'s gate) as part of the dashboard rebuild — see the other `admin/*` pages for what's actually new. */
export default function AdminMarketsPage() {
  const { adminKey } = useAdminKey();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: markets } = useQuery({ queryKey: qk.markets.list(), queryFn: api.listMarkets });

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

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Markets</h1>

      {error && <p className="mb-4 text-sm text-[var(--no)] break-all">{error}</p>}

      <div className="space-y-3">
        {markets?.map((m) => (
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
                  disabled={busyId === m.contractId}
                  onClick={() => act('settle', m.contractId)}
                >
                  Settle
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === m.contractId}
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
