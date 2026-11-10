'use client';

/**
 * Scoped boundary for the embeddable widget specifically — without this,
 * the root `error.tsx` would still catch a throw here, but it renders a
 * full-height "Go home" page, which looks broken inside a 360×420 iframe on
 * someone else's site. This stays small and has no outbound link (an embed
 * widget navigating the embedding page's iframe to Polaris would be its own
 * bad surprise for that site's visitor).
 */
export default function EmbedError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center gap-2 p-4 text-center">
      <p className="text-xs text-[var(--muted)]">This market widget hit an error.</p>
      <button
        type="button"
        onClick={reset}
        className="text-xs text-[var(--accent-ink)] underline hover:text-[var(--ink)]"
      >
        Try again
      </button>
    </div>
  );
}
