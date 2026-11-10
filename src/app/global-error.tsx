'use client';

/**
 * `error.tsx` only catches throws in pages/layouts BELOW the root layout —
 * if `RootLayout` itself (or a provider it mounts, e.g. `QueryProvider`/
 * `WalletProvider`) throws, nothing else in the tree can catch it. This is
 * the one boundary for that case, and per Next's App Router contract it
 * must render its own full `<html>`/`<body>` since the root layout that
 * would normally provide them is exactly what failed.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 20,
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ maxWidth: 360, fontSize: 14, color: '#666' }}>
            Polaris hit an unexpected error loading. Try reloading the page.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
