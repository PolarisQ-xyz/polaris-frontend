import { contract } from '@stellar/stellar-sdk';
import Freighter from '@stellar/freighter-api';
import { api } from './api';
import { config } from './config';

/**
 * Two ways a user ends up with a usable Soroban address, sharing the same
 * `callAsWallet` trade path — see `wallet-provider.tsx`'s doc comment for
 * why the email path exists. Neither needs client-side storage: Freighter
 * itself is the persistent source of truth for whether we're still
 * authorized (see `getConnectedAddress`, checked fresh on every mount —
 * unlike a passkey's credential id, there's nothing else worth caching),
 * and `'email'` persists as an httpOnly session cookie the backend already
 * owns.
 */
export type StoredWallet = { kind: 'freighter'; address: string } | { kind: 'email'; address: string };

/**
 * Freighter's own extension UI has no built-in timeout — if its popup is
 * dismissed without being closed (or never opens, e.g. a stale extension
 * state), the awaited promise can hang forever with the trade button stuck
 * busy and no way to cancel. Wrapping each user-facing Freighter call keeps
 * every hang bounded and recoverable instead.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

const CONNECT_TIMEOUT_MS = 45_000;
const SIGN_TIMEOUT_MS = 90_000;

/** `false` only when the Freighter extension itself isn't installed — distinct from "installed but not yet authorized," which `connectFreighter` handles via its own prompt. */
export async function isFreighterAvailable(): Promise<boolean> {
  const { isConnected, error } = await Freighter.isConnected();
  return !error && isConnected;
}

/**
 * Silent restore on mount: Freighter's own `getAddress()` returns `""`
 * until this origin has been granted access, so a non-empty address here
 * means we're already authorized — no prompt needed. Returns `null` on any
 * error or if the extension isn't installed at all, same as "not connected."
 */
export async function getConnectedAddress(): Promise<string | null> {
  const { isConnected, error: connError } = await Freighter.isConnected();
  if (connError || !isConnected) return null;
  const { address, error } = await Freighter.getAddress();
  if (error || !address) return null;
  return address;
}

/**
 * First-time connect: prompts Freighter's own authorization UI, then
 * verifies the wallet is actually on the network this app trades on — a
 * trade signed on the wrong network fails confusingly far downstream
 * otherwise (see the Transaction UX Checklist this mirrors in
 * `stellar-dev:dapp`'s skill doc).
 */
export async function connectFreighter(): Promise<string> {
  const { isConnected, error: availError } = await Freighter.isConnected();
  if (availError || !isConnected) {
    throw new Error('Freighter extension not found — install it from freighter.app, then reload this page.');
  }

  const { address, error } = await withTimeout(
    Freighter.requestAccess(),
    CONNECT_TIMEOUT_MS,
    'Freighter didn’t respond to the connect prompt — check the extension popup, or try again.',
  );
  if (error || !address) {
    throw new Error(error?.message ?? 'Connection was cancelled.');
  }

  const { networkPassphrase, error: netError } = await Freighter.getNetwork();
  if (netError) {
    throw new Error(netError.message);
  }
  if (networkPassphrase !== config.stellarNetworkPassphrase) {
    throw new Error(
      `Freighter is set to the wrong network. Switch it to Testnet (currently: ${networkPassphrase}) and try again.`,
    );
  }

  return address;
}

/**
 * `Prediction` is a Rust unit-variant enum (`Yes`/`No`); the native JS
 * shape the generated contract client expects for it is `{tag, values}` —
 * matching exactly what `polaris-oracle`'s `wire-args.ts` constructs by
 * hand for the same contract call (`coerceWireArgs`'s `scSpecTypeUdt`
 * branch), not a bare string. Keep these two in sync if either changes.
 */
function predictionScVal(tag: string): { tag: string; values: undefined } {
  return { tag, values: undefined };
}

/**
 * Which wire-arg key holds the i128 amount(s) for each sponsorable
 * function, and which key is the `Prediction` enum, if any — the frontend
 * equivalent of `wire-args.ts`'s per-function field knowledge, since the
 * browser builds and signs its own transaction now instead of asking the
 * backend to. Keep in sync with that file's `AUTH_ADDRESS_PARAM`/switch.
 */
const I128_FIELDS: Record<string, string[]> = {
  buy: ['collateral_amount', 'min_shares_out'],
  sell: ['shares_in', 'min_collateral_out'],
  split: ['amount'],
  merge: ['amount'],
  transfer: ['amount'],
  redeem: [],
};
const PREDICTION_FIELD: Partial<Record<string, string>> = {
  buy: 'prediction',
  sell: 'prediction',
  transfer: 'prediction',
};
const AUTH_ADDRESS_PARAM: Record<string, string> = {
  buy: 'user',
  sell: 'user',
  split: 'user',
  merge: 'user',
  redeem: 'user',
  transfer: 'from',
};

type TradeFunction = 'buy' | 'sell' | 'split' | 'merge' | 'transfer' | 'redeem';

/** Minimal typed surface for the one generated-client call `callAsWallet` makes — see `polaris-oracle`'s `stellar.service.ts` for why the backend's own typed interfaces don't cover these (it never calls them directly; it only ever relayed a user's own signed call). */
type TradeContract = Record<
  TradeFunction,
  (args: Record<string, unknown>) => Promise<contract.AssembledTransaction<unknown>>
>;

/**
 * Runs a market/perpetual contract call authorized by the stored wallet.
 *
 * - `'freighter'`: builds, simulates, and signs the transaction directly
 *   against Soroban RPC — `contract.Client.from` fetches the contract's
 *   real interface from the network (no bundled wasm/spec needed), and
 *   Freighter's own `signTransaction` plugs in as the client's signer
 *   as-is (the SDK's `Signer` type is documented to match it exactly). No
 *   backend relay, no sponsored fee — the connected wallet pays its own,
 *   same as any other Soroban dapp.
 * - `'email'`: unchanged — a single call to `/auth/email/trade`, which
 *   signs with the session's server-held custodial key (see
 *   `EmailAuthService`) via the same WebAuthn-shaped smart-wallet
 *   `__check_auth` the (now-removed) passkey path used.
 */
export async function callAsWallet(
  wallet: StoredWallet,
  contractId: string,
  functionName: TradeFunction,
  args: Record<string, string | number>,
  contractKind?: 'market' | 'perpetual',
): Promise<{ txHash: string }> {
  if (wallet.kind === 'email') {
    return api.emailTrade({ contractId, function: functionName, args, contractKind });
  }

  const nativeArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    nativeArgs[key] = I128_FIELDS[functionName]?.includes(key) ? BigInt(value) : value;
  }
  if (PREDICTION_FIELD[functionName]) {
    const field = PREDICTION_FIELD[functionName]!;
    nativeArgs[field] = predictionScVal(nativeArgs[field] as string);
  }
  nativeArgs[AUTH_ADDRESS_PARAM[functionName]] = wallet.address;

  const client = (await contract.Client.from({
    contractId,
    rpcUrl: config.stellarRpcUrl,
    networkPassphrase: config.stellarNetworkPassphrase,
    publicKey: wallet.address,
    signTransaction: (xdr, opts) =>
      withTimeout(
        Freighter.signTransaction(xdr, opts),
        SIGN_TIMEOUT_MS,
        'Freighter didn’t respond to the signing request — check the extension popup, or try again.',
      ),
  })) as unknown as contract.Client & TradeContract;

  const tx = await client[functionName](nativeArgs);
  const sent = await tx.signAndSend();
  return { txHash: sent.sendTransactionResponse?.hash ?? sent.getTransactionResponse?.txHash ?? '' };
}
