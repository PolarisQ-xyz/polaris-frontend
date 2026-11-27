import { config } from './config';

/** A hung oracle (not erroring, just never responding) would otherwise leave every caller's busy state stuck forever with no recourse — same failure shape `freighter-wallet.ts`'s `withTimeout` guards against for signing. */
export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Admin mutations (`createMarket`, `createPerpetual`, settle/cancel/terminate/checkpoint)
 * make the backend shell out to `stellar contract deploy` / `invoke`, which is
 * routinely slower than 20s. Aborting them client-side doesn't stop the
 * server, so a too-short budget just invites a blind retry that deploys a
 * duplicate funded market (#101).
 */
export const ADMIN_MUTATION_TIMEOUT_MS = 120_000;

type RequestOptions = RequestInit & {
  /** Per-call timeout override; ignored when the caller passes its own `signal`. */
  timeoutMs?: number;
};

/** True when a request was aborted by its timeout (or a caller's abort), not rejected by the server. */
export function isTimeoutError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}

/** Shown instead of a generic failure when an admin mutation times out — the server may still finish (#101). */
export const MUTATION_TIMEOUT_MESSAGE =
  'The request timed out, but the backend may still be processing it. Check the Markets list before retrying — retrying now could create a duplicate.';

async function request<T>(path: string, init?: RequestOptions, validate?: Validator<T>): Promise<T> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...fetchInit } = init ?? {};
  const res = await fetch(`${config.oracleUrl}${path}`, {
    ...fetchInit,
    // Needed for the email-login session cookie (httpOnly, set by the
    // backend) to be sent on same-site-but-cross-origin requests like
    // localhost:3000 -> localhost:3001. Harmless for every other endpoint,
    // which simply has no cookie to send.
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...init?.headers },
    signal: init?.signal ?? AbortSignal.timeout(timeoutMs),
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

/** Error copy for admin mutations: a timeout warns against blind retry (#101); anything else uses the backend's own message. */
export function mutationErrorMessage(err: unknown): string {
  return isTimeoutError(err) ? MUTATION_TIMEOUT_MESSAGE : messageFromApiError(err);
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
    request<{ yesBps: number; noBps: number; yesBpsChange: number | null }>(`/markets/${id}/price`, undefined, validatePrice),
  getFee: (id: string) => request<{ feeBps: number }>(`/markets/${id}/fee`, undefined, validateFee),
  getTickerPrice: (feedId: string) => request<unknown>(`/prices/${feedId}`),

  faucet: (address: string) =>
    request<{ funded: boolean; alreadyExists: boolean }>('/markets/faucet', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }),

  /** Spendable native-XLM collateral balance, in stroops — same shape for a Freighter or email-custodial wallet. */
  getBalance: (address: string) =>
    request<{ balanceStroops: string }>(`/wallets/balance?address=${encodeURIComponent(address)}`),

  // email login (fallback for browsers/devices without a Freighter-like wallet extension — see `wallet-provider.tsx`)
  requestEmailCode: (email: string) =>
    request<{ sent: boolean }>('/auth/email/request', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyEmailCode: (email: string, code: string) =>
    request<{ address: string }>('/auth/email/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  getEmailSession: () => request<{ email: string; address: string }>('/auth/email/me'),
  emailLogout: () => request<{ ok: boolean }>('/auth/email/logout', { method: 'POST' }),
  emailTrade: (params: {
    contractId: string;
    function: string;
    args: Record<string, string | number>;
    contractKind?: 'market' | 'perpetual';
  }) => request<{ txHash: string }>('/auth/email/trade', { method: 'POST', body: JSON.stringify(params) }),

  // perpetuals — see `polaris-oracle/README.md`'s "Perpetual markets" for
  // why this is a parallel set of endpoints/types, not a `market`-shaped
  // union: no strike/expiry/settle exist on this contract at all.
  listPerpetuals: () => request<WatchedPerpetual[]>('/perpetuals'),
  getPerpetual: (id: string) => request<WatchedPerpetual>(`/perpetuals/${id}`),
  getPerpetualState: (id: string) => request<OnChainPerpetual>(`/perpetuals/${id}/state`, undefined, validatePerpetualState),
  getPerpetualPosition: (id: string, address: string) =>
    request<{ yes: string; no: string }>(
      `/perpetuals/${id}/position?address=${encodeURIComponent(address)}`,
      undefined,
      validatePosition,
    ),
  getPerpetualPrice: (id: string) => request<{ yesBps: number; noBps: number }>(`/perpetuals/${id}/price`, undefined, validatePrice),
  getPerpetualFee: (id: string) => request<{ feeBps: number }>(`/perpetuals/${id}/fee`, undefined, validateFee),

  // admin — every mutation below uses ADMIN_MUTATION_TIMEOUT_MS (#101)
  /** Pass `signal` to cancel from the UI; it replaces the built-in timeout entirely. */
  createPerpetual: (adminKey: string, body: Record<string, unknown>, signal?: AbortSignal) =>
    request<WatchedPerpetual & { initTxHash: string }>('/perpetuals/create', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: JSON.stringify(body),
      timeoutMs: ADMIN_MUTATION_TIMEOUT_MS,
      signal,
    }),
  triggerTerminate: (adminKey: string, id: string) =>
    request<WatchedPerpetual>(`/perpetuals/${id}/terminate`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      timeoutMs: ADMIN_MUTATION_TIMEOUT_MS,
    }),
  /** Admin-triggered, not scheduled — see `polaris-oracle/README.md`'s "Perpetual markets". Only meaningful for a perpetual whose `price_oracle` bundle is actually configured (`MOCK_REDSTONE_CONTRACT` set on the backend); otherwise the backend itself returns a clear error. */
  triggerCheckpoint: (adminKey: string, id: string) =>
    request<OnChainPerpetual & { txHash: string }>(`/perpetuals/${id}/checkpoint`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      timeoutMs: ADMIN_MUTATION_TIMEOUT_MS,
    }),

  // admin
  /** Pass `signal` to cancel from the UI; it replaces the built-in timeout entirely. */
  createMarket: (adminKey: string, body: Record<string, unknown>, signal?: AbortSignal) =>
    request<WatchedMarket & { initTxHash: string }>('/markets/create', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: JSON.stringify(body),
      timeoutMs: ADMIN_MUTATION_TIMEOUT_MS,
      signal,
    }),
  triggerSettle: (adminKey: string, id: string) =>
    request<WatchedMarket>(`/markets/${id}/settle`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      timeoutMs: ADMIN_MUTATION_TIMEOUT_MS,
    }),
  triggerCancel: (adminKey: string, id: string) =>
    request<WatchedMarket>(`/markets/${id}/cancel`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      timeoutMs: ADMIN_MUTATION_TIMEOUT_MS,
    }),

  // admin dashboard — every call here is what AdminKeyProvider's gate probes with
  getAdminOverview: (adminKey: string) => adminGet<AdminOverview>('/admin/overview', adminKey),
  getAdminFeeRevenue: (adminKey: string) => adminGet<AdminFeeRevenue>('/admin/fee-revenue', adminKey),
  getAdminTreasury: (adminKey: string) => adminGet<AdminTreasury>('/admin/treasury', adminKey),
  getAdminWallets: (adminKey: string) => adminGet<AdminWallets>('/admin/wallets', adminKey),
  getAdminNetwork: (adminKey: string) => adminGet<AdminNetwork>('/admin/network', adminKey),
  getAdminSettlementChecks: (adminKey: string) =>
    adminGet<{ checks: SettlementCheck[] }>('/admin/settlement-checks', adminKey),
};
