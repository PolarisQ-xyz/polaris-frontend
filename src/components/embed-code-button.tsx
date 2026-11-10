'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Generates the `<iframe>` snippet for a market's embeddable widget
 * (`/embed/[id]`). No special `allow` permissions needed: Freighter is a
 * browser extension, not a page API gated by permissions policy, so it
 * works inside a cross-origin iframe same as the top-level app.
 */
export function EmbedCodeButton({ contractId }: { contractId: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (typeof window === 'undefined') return null;
  const origin = window.location.origin;
  const snippet = `<iframe
  src="${origin}/embed/${contractId}"
  width="360" height="420"
  style="border:0;border-radius:16px;overflow:hidden"
  title="Polaris market"
></iframe>`;

  return (
    <div>
      <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide embed code' : 'Get embed code'}
      </Button>
      {open && (
        <div className="mt-3 space-y-2">
          <pre className="max-w-full overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-3 text-xs">
            {snippet}
          </pre>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard.writeText(snippet);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <p className="text-xs text-[var(--faint)]">
            No special permissions needed — Freighter and the email fallback both work inside the
            embed as-is.
          </p>
        </div>
      )}
    </div>
  );
}
