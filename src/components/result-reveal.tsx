'use client';

import Link from 'next/link';
import { didWin, redeemableValue, type MarketStatus, type Position } from '@/lib/portfolio';
import { useFormatStroops } from '@/lib/display-currency';

/**
 * The one deliberate "moment" in this app — what a bettor sees the instant
 * their market resolves, replacing the plain "Trading is closed" text.
 * Reuses `didWin`/`redeemableValue` from `lib/portfolio.ts` rather than
 * re-deriving win/loss here — a second copy of that math is exactly the
 * failure mode `lib/portfolio.ts`'s own doc comment warns about.
 *
 * The `result-reveal--in` class is applied unconditionally, not behind a
 * "did this just mount" guard — a CSS animation tied to a class only plays
 * when the class is first applied to an element actually entering the DOM,
 * not on every re-render that keeps rendering the same class name (e.g. the
 * poll-driven refetches that keep this data fresh), so no JS-side "played
 * once" bookkeeping is needed. `prefers-reduced-motion` is handled in
 * `globals.css`, not here, so it degrades correctly regardless of when/how
 * this mounts.
 *
 * The outcome is announced to screen readers via a `role="status"` /
 * `aria-live="polite"` region. That region is rendered even while the market
 * is still `Open` (visually empty), so it exists in the accessibility tree
 * *before* resolution — a live region only announces changes to content that
 * was already present, so mounting it at resolution time would stay silent.
 */
export function ResultReveal({
  status,
  position,
  nextRoundHref,
  compact = false,
}: {
  status: MarketStatus;
  position: Position;
  /** Link to this market's auto-rolled successor, once `useNextRound` has found one. */
  nextRoundHref?: string;
  compact?: boolean;
}) {
  const formatStroops = useFormatStroops();
  const resolved = status !== 'Open';

  const tone = status === 'Cancelled' ? 'neutral' : didWin(status, position) ? 'won' : 'lost';
  const payout = redeemableValue(status, position);

  const headline =
    tone === 'neutral' ? 'Market cancelled' : tone === 'won' ? 'You won' : "Didn't win this one";
  const detail =
    tone === 'neutral'
      ? `Refunded ${formatStroops(payout)}`
      : tone === 'won'
        ? `+${formatStroops(payout)}`
        : null;

  return (
    <div
      className={[
        'result-reveal',
        `result-reveal--${tone}`,
        'result-reveal--in',
        compact ? 'result-reveal--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className="result-reveal__headline">{headline}</p>
      {detail && <p className="result-reveal__detail">{detail}</p>}
      {nextRoundHref && (
        <Link href={nextRoundHref} className="result-reveal__next">
          Next round is live →
        </Link>
      )}
    </div>
  );
}
