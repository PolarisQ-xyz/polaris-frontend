'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, messageFromApiError } from '@/lib/api';
import { useAdminKey } from '@/lib/admin-key-provider';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { shortAddress, formatDateTime } from '@/lib/format';
import { qk } from '@/lib/query-keys';

function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  return `${local[0]}${'*'.repeat(Math.max(local.length - 1, 1))}${domain}`;
}

export default function AdminWalletsPage() {
  const { adminKey } = useAdminKey();
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: qk.admin.wallets(adminKey),
    queryFn: () => api.getAdminWallets(adminKey),
    refetchInterval: 30_000,
  });

  const toggleRevealed = (address: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(address)) {
        next.delete(address);
      } else {
        next.add(address);
      }
      return next;
    });
  };

  // A failed background refetch keeps showing the last good data.
  if (error && !data && !isLoading) {
    return (
      <div role="alert" className="space-y-3">
        <p className="text-sm text-[var(--no)] break-all">{messageFromApiError(error)}</p>
        <Button size="sm" variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading || !data) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Wallets</h1>

      <Card className="mb-6">
        <CardBody>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Email wallets</h2>
            <Badge tone="accent">{data.emailWallets.length} total</Badge>
          </div>
          <p className="mb-3 text-xs text-[var(--faint)]">
            Exhaustive — every one is created by this backend.
          </p>
          {data.emailWallets.length === 0 ? (
            <p className="text-sm text-[var(--faint)]">None yet.</p>
          ) : (
            <div className="space-y-2">
              {data.emailWallets.map((w) => (
                <div
                  key={w.address}
                  className="flex items-center justify-between border-t border-[var(--line)] py-2 text-sm first:border-t-0 first:pt-0"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{revealed.has(w.address) ? w.email : maskEmail(w.email)}</span>
                      <button
                        type="button"
                        onClick={() => toggleRevealed(w.address)}
                        className="text-xs text-[var(--faint)] underline hover:text-[var(--fg)]"
                        aria-label={revealed.has(w.address) ? 'Hide email' : 'Reveal email'}
                      >
                        {revealed.has(w.address) ? 'Hide' : 'Reveal'}
                      </button>
                    </div>
                    <div className="font-mono text-xs text-[var(--faint)]">{shortAddress(w.address)}</div>
                  </div>
                  <div className="text-xs text-[var(--faint)]">{formatDateTime(w.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Passkey addresses seen</h2>
            <Badge tone="accent">{data.passkeyAddressesSeen.length} total</Badge>
          </div>
          <p className="mb-3 text-xs text-[var(--faint)]">
            Not exhaustive — there&apos;s no registry, on-chain or off, of every passkey wallet ever deployed.
            This is only addresses that have made at least one trade since this dashboard shipped.
          </p>
          {data.passkeyAddressesSeen.length === 0 ? (
            <p className="text-sm text-[var(--faint)]">None seen yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1 font-mono text-xs sm:grid-cols-2">
              {data.passkeyAddressesSeen.map((address) => (
                <div key={address} className="text-[var(--faint)]">
                  {shortAddress(address)}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
