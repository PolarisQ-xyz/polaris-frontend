import Link from 'next/link';

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--line)]">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-sm">
            <Link href="/welcome" className="flex items-center gap-2 text-base font-bold">
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #5b4fe0, #8b7bff)' }}
              >
                ◈
              </span>
              Polaris
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              A fully-collateralized prediction market on XLM/USD, settled automatically by a live price feed.
            </p>
          </div>

          <nav aria-label="Footer" className="flex gap-10 text-sm">
            <div>
              <h2 className="mb-3 font-semibold text-[var(--ink)]">Product</h2>
              <ul className="space-y-2 text-[var(--muted)]">
                <li>
                  <Link href="/" className="transition-colors hover:text-[var(--ink)]">
                    Markets
                  </Link>
                </li>
                <li>
                  <Link href="/docs" className="transition-colors hover:text-[var(--ink)]">
                    Docs
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <p className="mt-10 max-w-3xl border-t border-[var(--line)] pt-6 text-xs leading-relaxed text-[var(--faint)]">
          Polaris is experimental software on Stellar testnet. Prediction market positions can lose value,
          including your full stake. Nothing here is financial advice, and Polaris may not be available or
          appropriate in every jurisdiction — check your local regulations before trading. This placeholder
          disclaimer needs a real legal review before any production launch.
        </p>

        <p className="mt-6 text-xs text-[var(--faint)]">© {new Date().getFullYear()} Polaris.</p>
      </div>
    </footer>
  );
}
