import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardBody } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { Reveal } from './reveal';

/**
 * Embeds a real market via this app's own `/embed/[id]` widget when one is
 * configured — the actual product, not a mockup. Falls back to a clearly
 * non-fake placeholder (with a path to real markets) rather than pointing
 * an iframe at a market that doesn't exist, which would just show a
 * loading/error state to every visitor.
 */
export function TryItLive() {
  const marketId = process.env.NEXT_PUBLIC_FEATURED_MARKET_ID;

  return (
    <section id="try-it" className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Try it live</h2>
          <p className="mt-4 text-lg text-[var(--ink-soft)]">
            This is the real product, embedded right here — not a screenshot.
          </p>
        </div>
      </Reveal>

      <Reveal delayMs={100} className="mt-10 flex justify-center">
        {marketId ? (
          <iframe
            src={`/embed/${marketId}`}
            title="Live Polaris market"
            width={360}
            height={420}
            loading="lazy"
            allow="publickey-credentials-get *; publickey-credentials-create *"
            className="max-w-full rounded-2xl border border-[var(--line)] shadow-lg"
          />
        ) : (
          <Card className="max-w-md text-center">
            <CardBody className="space-y-4 py-10">
              <p className="text-sm text-[var(--muted)]">
                No market is featured here yet — but every market in the app is embeddable exactly like this.
              </p>
              <Link href="/" className={cn(buttonVariants({ variant: 'primary', size: 'md' }))}>
                Browse live markets
              </Link>
            </CardBody>
          </Card>
        )}
      </Reveal>
    </section>
  );
}
