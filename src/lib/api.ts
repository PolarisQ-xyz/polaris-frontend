import { config } from './config';

/** A hung oracle (not erroring, just never responding) would otherwise leave every caller's busy state stuck forever with no recourse — same failure shape `freighter-wallet.ts`'s `withTimeout` guards against for signing. */
const REQUEST_TIMEOUT_MS = 20_000;

async function request<T>(path: string, init?: RequestInit, validate?: Validator<T>): Promise<T> {
  const res = await fetch(`${config.oracleUrl}${path}`, {
    ...init,
    // Needed for the email-login session cookie (httpOnly, set by the
    // backend) to be sent on same-site-but-cross-origin requests like
    // localhost:3000 -> localhost:3001. Harmless for every other endpoint,
    // which simply has no cookie to send.
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init?.headers },
    signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status} ${body}`) as ApiError;
    err.status = res.status;
    throw err;
  }
  const body: unknown = await res.json();
  return validate ? validate(body, `${init?.method ?? 'GET'} ${path}`) : (body as T);
}

/**
 * Runtime guards for the shapes that feed `BigInt()` math and status unions.
 * The oracle is versioned independently, so a contract break should surface
 * as a message naming the endpoint and field — not a `BigInt` `SyntaxError`
 * thrown mid-render.
 */
type Validator<T> = (body: unknown, endpoint: string) => T;

export class ApiContractError extends Error {
  constructor(endpoint: string, field: string, detail: string) {
    super(`Unexpected response from ${endpoint}: field "${field}" ${detail}`);
    this.name = 'ApiContractError';
  }
}

function asObject(body: unknown, endpoint: string): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ApiContractError(endpoint, '(body)', `expected an object, got ${JSON.stringify(body)}`);
  }
  return body as Record<string, unknown>;
}

const INTEGER_STRING = /^-?\d+$/;

function checkIntegerStrings(o: Record<string, unknown>, endpoint: string, fields: string[]) {
  for (const f of fields) {
    if (typeof o[f] !== 'string' || !INTEGER_STRING.test(o[f] as string)) {
      throw new ApiContractError(endpoint, f, `expected an integer string, got ${JSON.stringify(o[f])}`);
    }
  }
}

function checkNumbers(o: Record<string, unknown>, endpoint: string, fields: string[]) {
  for (const f of fields) {
    if (typeof o[f] !== 'number' || !Number.isFinite(o[f])) {
      throw new ApiContractError(endpoint, f, `expected a number, got ${JSON.stringify(o[f])}`);
    }
  }
}

function checkStatus(o: Record<string, unknown>, endpoint: string, allowed: readonly string[]) {
  if (typeof o.status !== 'string' || !allowed.includes(o.status)) {
    throw new ApiContractError(
      endpoint,
      'status',
      `has unknown value ${JSON.stringify(o.status)} (expected one of ${allowed.join(', ')})`,
    );
  }
}

function shape<T>(check: (o: Record<string, unknown>, endpoint: string) => void): Validator<T> {
  return (body, endpoint) => {
    const o = asObject(body, endpoint);
    check(o, endpoint);
    return o as T;
  };
}

export const ON_CHAIN_MARKET_STATUSES = ['Open', 'ResolvedYes', 'ResolvedNo', 'Cancelled'] as const;
export const ON_CHAIN_PERPETUAL_STATUSES = ['Open', 'Terminated'] as const;

const validateMarketState = shape<OnChainMarket>((o, e) => {
  checkIntegerStrings(o, e, ['poolYes', 'poolNo', 'totalSupply', 'strikePrice', 'finalPrice']);
  checkStatus(o, e, ON_CHAIN_MARKET_STATUSES);
});
const validatePerpetualState = shape<OnChainPerpetual>((o, e) => {
  checkIntegerStrings(o, e, ['poolYes', 'poolNo', 'totalSupply']);
  checkStatus(o, e, ON_CHAIN_PERPETUAL_STATUSES);
});
const validatePosition = shape<{ yes: string; no: string }>((o, e) => checkIntegerStrings(o, e, ['yes', 'no']));
const validateFee = shape<{ feeBps: number }>((o, e) => checkNumbers(o, e, ['feeBps']));
const validatePrice = shape<{ yesBps: number; noBps: number; yesBpsChange: number | null }>((o, e) => {
  checkNumbers(o, e, ['yesBps', 'noBps']);
  if (o.yesBpsChange != null) checkNumbers(o, e, ['yesBpsChange']);
});

export type ApiError = Error & { status?: number };

/** True only for a real "this key is wrong/missing" response — see `AdminGuard`, which throws `UnauthorizedException` (401) specifically so callers like `AdminKeyProvider`'s probe can rely on this rather than guessing from a generic network failure. */
export function isUnauthorized(err: unknown): boolean {
  return (err as ApiError)?.status === 401;
}

function adminGet<T>(path: string, adminKey: string): Promise<T> {
  return request<T>(path, { headers: { 'x-admin-key': adminKey } });
}

/** `request()` above throws a generic `METHOD /path failed: 400 {...}` error — pull the backend's own message out of the JSON body when possible instead of showing that raw text to a user. */
export function messageFromApiError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  const jsonStart = message.indexOf('{');
  if (jsonStart === -1) return message;
  try {
    const body = JSON.parse(message.slice(jsonStart)) as { message?: string | string[] };
    if (typeof body.message === 'string') return body.message;
    if (Array.isArray(body.message)) return body.message.join('; ');
    return message;
  } catch {
    return message;
  }
}

export interface WatchedMarket {
  contractId: string;
  strikePriceCents: string;
  expiry: number;
  gracePeriodSecs: number;
  feedId: number;
  status: 'watching' | 'settling' | 'settled' | 'cancelling' | 'cancelled' | 'pending';
  lastError?: string;
  settleTxHash?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OnChainMarket {
  admin: string;
  collateral: string;
  strikePrice: string;
  expiry: string;
  gracePeriod: string;
  lazerContract: string;
  feedId: number;
  baseFeeBps: number;
  minFeeBps: number;
  treasury: string;
  status: 'Open' | 'ResolvedYes' | 'ResolvedNo' | 'Cancelled';
  finalPrice: string;
  poolYes: string;
  poolNo: string;
  totalSupply: string;
  initialLiquidity: string;
}

/**
 * Shared query options for live market data (price, pool state, fees, positions).
 *
 * These queries opt into `refetchOnWindowFocus` so that returning to the tab
 * immediately refreshes stale reserves/odds instead of waiting for the next
 * poll. React Query still respects `staleTime`, so a focus event only triggers
 * a refetch when the cached data is actually stale — no refetch storm.
 */
export const liveMarketQueryOptions = {
  refetchOnWindowFocus: true,
} as const;

/**
 * Shared query options for admin and list queries, which should not refetch
 * on window focus.
 */
export const staticQueryOptions = {
  refetchOnWindowFocus: false,
} as const;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  });
}

export const api = {
  listMarkets: () => request<WatchedMarket[]>('/markets'),
  /** Every tracked market for one feed, newest first — used to find a resolved market's auto-rolled successor (see MarketFactoryService in polaris-oracle). */
  listMarketsForFeed: (feedId: number) => request<WatchedMarket[]>(`/markets?feedId=${feedId}`),
  getMarket: (id: string) => request<WatchedMarket>(`/markets/${id}`),
  getMarketState: (id: string) => request<OnChainMarket>(`/markets/${id}/state`, undefined, validateMarketState),
  getPosition: (id: string, address: string) =>
    request<{ yes: string; no: string }>(
      `/markets/${id}/position?address=${encodeURIComponent(address)}`,
      undefined,
      validatePosition,
    ),
  getPrice: (id: string) =>
    request<{ yesBps: number; noBps: number; yesBpsChange: number | null }>(`/markets/${id}

/* … truncated 4742 chars — edit only what you need near the top … */
