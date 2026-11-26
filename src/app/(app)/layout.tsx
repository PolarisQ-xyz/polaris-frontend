'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@/lib/wallet-provider';
import { usePortfolioValue } from '@/lib/use-portfolio-value';
import { AuthControls } from '@/components/auth-controls';
import { stroopsToXlm } from '@/lib/format';
import { LogoMark } from '@/components/logo-mark';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { wallet, error } = useWallet();
  const portfolio = usePortfolioValue();
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--surface-2)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--ink)] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <LogoMark size="sm" />
            Polaris
          </Link>
          <nav className="order-3 flex w-full basis-full items-center justify-center gap-4 text-sm text-[var(--ink-soft)] sm:order-none sm:w-auto sm:basis-auto sm:justify-start">
            <Link
              href="/"
              aria-current={pathname === '/' ? 'page' : undefined}
              className="hover:text-[var(--ink)]"
            >
              Markets
            </Link>
            <Link
              href="/perpetuals"
              aria-current={pathname === '/perpetuals' ? 'page' : undefined}
              className="hover:text-[var(--ink)]"
            >
              Perpetuals
            </Link>
            <Link
              href="/bets"
              aria-current={pathname === '/bets' ? 'page' : undefined}
              className="hover:text-[var(--ink)]"
            >
              Portfolio
            </Link>
            <Link
              href="/docs"
              aria-current={pathname === '/docs' ? 'page' : undefined}
              className="hover:text-[var(--ink)]"
            >
              Docs
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {wallet && (portfolio?.hasPosition || portfolio?.incomplete) && (
              <Link
                href="/bets"
                title={portfolio.incomplete ? 'Some positions could not be loaded; total is a lower bound' : undefined}
                className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:opacity-80"
              >
                {portfolio.incomplete ? '≥ ' : ''}
                {stroopsToXlm(portfolio.total)} XLM in play
              </Link>
            )}
            <AuthControls />
          </div>
        </div>
        {error && <div className="mx-auto max-w-5xl px-4 pb-2 text-xs text-[var(--no)]">{error}</div>}
      </header>
      <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
