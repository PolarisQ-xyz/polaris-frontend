'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Root error boundary — Next.js auto-wires this around every page below the
 * root layout. Without it (there was none anywhere in this app), any
 * render-time throw — e.g. a malformed API response's `BigInt(...)`
 * destructure — white-screened the whole app with Next's generic unstyled
 * digest page and no recovery path. `reset()` re-renders the segment that
 * threw, which is enough for anything transient (a bad query response that
 * refetches clean on retry).
 */
export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="text-xl font-semibold text-[var(--ink)]">Something went wrong</h1>
      <p className="max-w-sm text-sm text-[var(--muted)]">
        This page hit an unexpected error. It&rsquo;s been logged — try again, or head back home.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className="flex items-center text-sm text-[var(--muted)] underline hover:text-[var(--ink)]">
          Go home
        </Link>
      </div>
    </div>
  );
}
