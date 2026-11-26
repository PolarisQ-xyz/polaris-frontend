const STROOPS_PER_XLM = 10_000_000n;

/**
 * Native XLM (and this market's collateral/shares) use 7 decimal places.
 *
 * Negative inputs are supported: the magnitude is formatted and a leading
 * `-` is prepended, so `stroopsToXlm(-12_345_678n)` returns `"-1.23"`.
 */
export function stroopsToXlm(stroops: string | bigint, fractionDigits = 2): string {
  const value = typeof stroops === 'string' ? BigInt(stroops) : stroops;
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / STROOPS_PER_XLM;
  const frac = abs % STROOPS_PER_XLM;
  const fracStr = frac.toString().padStart(7, '0').slice(0, fractionDigits);
  return `${negative ? '-' : ''}${whole.toString()}.${fracStr}`;
}

/**
 * Throws a human-readable `Error` (not a raw `BigInt()` `SyntaxError`) for
 * anything that isn't a plain non-negative decimal — e.g. `1,000` from a
 * comma-thousands-separator locale, or stray text. `messageFromApiError`
 * already passes a plain `Error`'s `.message` straight through unmodified
 * when it contains no JSON body, so a clean message here is the whole fix;
 * no new error type or extra handling needed at any call site.
 */
export function xlmToStroops(xlm: string): bigint {
  const trimmed = xlm.trim();
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(trimmed)) {
    throw new Error('Enter a valid amount, e.g. 10 or 10.5');
  }
  const [whole, frac = ''] = trimmed.split('.');
  if (frac.length > 7) {
    throw new Error('XLM supports at most 7 decimal places');
  }
  const fracPadded = frac.padEnd(7, '0');
  return BigInt(whole || '0') * STROOPS_PER_XLM + BigInt(fracPadded || '0');
}

export function centsToUsd(cents: string | bigint): string {
  const value = typeof cents === 'string' ? BigInt(cents) : cents;
  const whole = value / 100n;
  const frac = (value % 100n).toString().padStart(2, '0');
  return `$${whole.toString()}.${frac}`;
}

export type DisplayCurrency = 'stroops' | 'xlm' | 'usd';

export const DISPLAY_CURRENCIES: readonly DisplayCurrency[] = ['stroops', 'xlm', 'usd'];

export const DISPLAY_CURRENCY_LABELS: Record<DisplayCurrency, string> = {
  stroops: 'Stroops',
  xlm: 'XLM',
  usd: 'USD equivalent',
};

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === 'string' && (DISPLAY_CURRENCIES as readonly string[]).includes(value);
}

/**
 * Formats a stroop amount in the user's display currency. `usd` needs the
 * current XLM/USD price in cents; with no rate yet (still loading, or the
 * feed is down) it falls back to XLM rather than showing a made-up dollar
 * figure. USD is rounded down to the cent, an estimate not a quote.
 */
export function formatStroops(
  stroops: string | bigint,
  currency: DisplayCurrency = 'xlm',
  xlmUsdCents?: number | null,
): string {
  const value = typeof stroops === 'string' ? BigInt(stroops) : stroops;
  if (currency === 'stroops') {
    return `${value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} stroops`;
  }
  if (currency === 'usd' && xlmUsdCents != null && Number.isFinite(xlmUsdCents) && xlmUsdCents > 0) {
    const cents = (value * BigInt(Math.round(xlmUsdCents))) / STROOPS_PER_XLM;
    return `≈ ${centsToUsd(cents)}`;
  }
  return `${stroopsToXlm(value)} XLM`;
}

export function formatCountdown(expiryUnixSecs: number): string {
  const diff = expiryUnixSecs * 1000 - Date.now();
  if (diff <= 0) return 'expired';
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

/** `created_at`-style unix-ms timestamps (as stored by the admin-activity tables) into a locale-formatted date/time — admin dashboard only, no formatting need for this anywhere else yet. */
export function formatDateTime(unixMs: number): string {
  return new Date(unixMs).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const STATUS_LABELS: Record<string, string> = {
  watching: 'Open',
  pending: 'Settling',
  settling: 'Settling',
  cancelling: 'Cancelling',
  settled: 'Settled',
  cancelled: 'Cancelled',
  // Perpetual-only status (`WatchedPerpetualStatus`) — `watching` is
  // shared with classic markets above, so only this one needs adding.
  terminated: 'Terminated',
};

/** Backend/on-chain status strings are internal names (e.g. "watching") — this is what a customer should read instead. */
export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** While a tracked market is still open or mid-settlement, worth polling frequently so a resolution is caught within seconds instead of on next page load — see `components/result-reveal.tsx`. Once genuinely terminal (settled/cancelled), nothing about it changes again, so polling stops. */
export function isPollableStatus(status: string | undefined): boolean {
  return status === 'watching' || status === 'pending';
}

/** Short-interval polling isn't real push (no websocket/SSE exists) — frequent enough to feel near-instant around an expiry without hammering the backend indefinitely. */
export const RESOLUTION_POLL_MS = 8_000;
