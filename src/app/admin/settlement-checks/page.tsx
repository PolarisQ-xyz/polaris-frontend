'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAdminKey } from '@/lib/admin-key-provider';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime, shortAddress } from '@/lib/format';
import type { SettlementCheck } from '@/lib/api';

const OUTCOME_TONE = { ok: 'yes', skipped: 'neutral', failed: 'no' } as const;

export default function AdminSettlementChecksPage() {
  const { adminKey } = useAdminKey();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settlement-checks', adminKey],
    queryFn: () => api.getAdminSettlementChecks(adminKey),
    refetchInterval: 30_000,
  });

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Fraud &amp; Trust</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Every Lazer-vs-Reflector/Hermes settlement cross-check this backend has run, whichever way it came out
        — not just the failures.
      </p>

      {isLoading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : !data || data.checks.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm font-semibold">No checks recorded — this is expected here, not a bug.</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              The cross-check only runs inside a real settlement attempt, which itself only runs when a live
              price oracle is configured and available. Without one, every market falls straight through to
              the permissionless <code className="text-xs">cancel()</code> path instead, and this table stays
              empty by design — the same honest limit already documented for the cross-check itself.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </div>
      )}
    </div>
  );
}

function CheckRow({ check }: { check: SettlementCheck }) {
  return (
    <Card>
      <CardBody className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs text-[var(--faint)]">
            {shortAddress(check.market_contract_id)}
          </div>
          <div className="text-xs text-[var(--faint)]">{formatDateTime(check.created_at)}</div>
          {check.reason && <div className="mt-1 text-xs text-[var(--muted)]">{check.reason}</div>}
          {check.lazer_price_cents && check.hermes_price_cents && (
            <div className="mt-1 text-xs text-[var(--muted)]">
              Lazer {check.lazer_price_cents}c vs Hermes {check.hermes_price_cents}c
              {check.divergence_bps !== null && ` (${check.divergence_bps}bps)`}
            </div>
          )}
        </div>
        <Badge tone={OUTCOME_TONE[check.outcome]}>{check.outcome}</Badge>
      </CardBody>
    </Card>
  );
}
