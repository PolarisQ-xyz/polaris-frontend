import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardBody } from '@/components/ui/card';
import { OddsBar } from '@/components/odds-bar';
import { cn } from '@/lib/cn';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, #5b4fe055, transparent)' }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-2 lg:items-center lg:pb-28 lg:pt-32">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--accent-ink)]">
            Fully collateralized · No house edge
          </p>

          <h1 className="text-balance text-[clamp(2.25rem,5.5vw,3.75rem)] font-extrabold leading-[1.05] tracking-tight text-[var(--ink)]">
            Predict XLM&rsquo;s price.
            <br />
            No wallet required.
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-[var(--ink-soft)]">
            Polaris is a fully-collateralized prediction market, settled automatically by a
            live price feed. Sign in with Face ID or Touch ID — no browser extension, no seed
            phrase — and trade live, AMM-priced odds instead of locking in a static bet.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/?new=1"
              className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'shadow-lg shadow-[#5b4fe033]')}
            >
              Create your account
            </Link>
            <a href="#how-it-works" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
              See how it works
            </a>
          </div>

          <p className="mt-5 text-sm text-[var(--faint)]">
            No app to install. No XLM required to get started.
          </p>
        </div>

        <div className="relative">
          <Card className="mx-auto max-w-sm shadow-xl">
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--faint)]">
                  XLM/USD · example
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--yes)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--yes)] opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--yes)]" />
                  </span>
                  Live odds
                </span>
              </div>

              <h2 className="text-lg font-semibold leading-snug">
                Will XLM be ≥ $0.65 by Friday?
              </h2>

              <OddsBar yesBps={6400} noBps={3600} />

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className={cn(buttonVariants({ variant: 'yes', size: 'md' }), 'pointer-events-none')}>
                  Buy YES
                </div>
                <div className={cn(buttonVariants({ variant: 'no', size: 'md' }), 'pointer-events-none')}>
                  Buy NO
                </div>
              </div>

              <p className="text-center text-xs text-[var(--faint)]">
                Illustrative preview — try a real market below.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </section>
  );
}
