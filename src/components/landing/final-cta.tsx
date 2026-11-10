import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/cn';
import { Reveal } from './reveal';

export function FinalCta() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-24 text-center sm:px-8">
      <Reveal>
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
          Your first prediction is thirty seconds away
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--ink-soft)]">
          No waiting for a claim transaction. No Freighter? Sign in with email instead.
        </p>
        <div className="mt-8">
          <Link href="/?new=1" className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}>
            Connect wallet
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
