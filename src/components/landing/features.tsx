import { Card, CardBody } from '@/components/ui/card';
import { Reveal } from './reveal';

const FEATURES: { title: string; body: string; icon: React.ReactNode }[] = [
  {
    title: 'Connect your own wallet',
    body: 'Freighter signs every trade yourself — no custodial account holding your funds. No Freighter yet? Sign in with email instead.',
    icon: (
      <path d="M12 2a5 5 0 0 0-5 5v2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 7V7a3 3 0 1 1 6 0v2Zm3 4a2 2 0 1 1 0 4a2 2 0 0 1 0-4Z" />
    ),
  },
  {
    title: 'Live AMM pricing',
    body: 'Odds move with every trade, and you can exit a position before expiry — not just hold to resolution.',
    icon: <path d="M3 17l6-6 4 4 8-8M21 7v6h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    title: 'Fully collateralized',
    body: 'Every position is backed 1:1 by locked collateral. There’s no “empty pool” scenario — winners are always paid in full.',
    icon: <path d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Zm-1.2 13.3-3-3 1.4-1.4 1.6 1.6 4.6-4.6 1.4 1.4-6 6Z" />,
  },
  {
    title: 'Fees that shrink with volume',
    body: 'A cost-driven fee curve, not a static number — fees compress automatically as a market gets more active.',
    icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  },
  {
    title: 'Embeddable anywhere',
    body: 'Drop a live market into any site with one iframe — the same wallet connection works everywhere it’s embedded.',
    icon: <path d="M8 4 3 12l5 8M16 4l5 8-5 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  },
  {
    title: 'Permissionless safety net',
    body: 'If a market can’t settle, anyone can trigger a full refund after a grace period. Funds are never stuck waiting on one party.',
    icon: <path d="M12 2a10 10 0 1 0 10 10M22 2v6h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Why Polaris</h2>
          <p className="mt-4 text-lg text-[var(--ink-soft)]">
            Built to remove the two biggest reasons crypto-curious people bounce off prediction markets.
          </p>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delayMs={(i % 3) * 80}>
            <Card className="h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
              <CardBody>
                <div
                  aria-hidden
                  className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5">
                    {f.icon}
                  </svg>
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{f.body}</p>
              </CardBody>
            </Card>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
