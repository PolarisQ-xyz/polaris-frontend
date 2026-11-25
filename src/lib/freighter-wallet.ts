import type { contract } from '@stellar/stellar-sdk';
import Freighter from '@stellar/freighter-api';
import { api } from './api';
import { config } from './config';
import { AUTH_ADDRESS_PARAM, I128_FIELDS, PREDICTION_FIELD, type TradeFunction } from './trade-args';

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
 * Thrown when the user declines a Freighter signing/connect prompt. Declining
 * is a normal choice, not a failure — callers should treat this as a neutral
 * "cancelled" state (clear busy, no red error) rather than surfacing the raw
 * SDK/extension message.
 */
export class UserCancelledError extends Error {
  constructor(message = 'Cancelled.') {
    super(message);
    this.name = 'UserCancelledError';
  }
}

/**
 * Freighter's extension surfaces a user decline as a rejection whose message
 * varies by version ("User declined", "Request rejected", "The user rejected
 * this request", etc.). Match those shapes so we can map them to a typed
 * `UserCancelledError` instead of a red technical error.
 */
function isUserDeclined(message: string | undefined): boolean {
  if (!message) return false;
  return /declin|reject|cancel|denied|user closed/i.test(message);
}

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

/**
 * Known Stellar network passphrases mapped to their human-readable display
 * names. The expected network comes from `config.stellarNetworkPassphrase`,
 * which can be mainnet or futurenet as well as testnet — so the wrong-network
 * error must name whatever network this app is actually configured for, not a
 * hardcoded "Testnet". Unknown passphrases fall back to the raw value.
 */
const NETWORK_DISPLAY_NAMES: Record<string, string> = {
  'Test SDF Network ; September 2015': 'Testnet',
  'Public Global Stellar Network ; September 2015': 'Mainnet',
  'Test SDF Future Network ; October 2022': 'Futurenet',
};

/** Maps a network passphrase to a display name, falling back to the raw passphrase for unknown networks. */
export function networkDisplayName(passphrase: string): string {
  return NETWORK_DISPLAY_NAMES[passphrase] ?? passphrase;
}

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
    if (isUserDeclined(error?.message)) {
      throw new UserCancelledError();
    }
    throw new Error(error?.message ?? 'Connection was cancelled.');
  }

  const { networkPassphrase, error: netError } = await Freighter.getNetwork();
  if (netError) {
    throw new Error(netError.message);
  }
  if (networkPassphrase !== config.stellarNetworkPassphrase) {
    const expected = networkDisplayName(config.stellarNetworkPassphrase);
    throw new Error(
      `Freighter is set to the wrong network. Switch it to ${expected} (currently: ${networkPassphrase}) and try again.`,
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


/** Minimal typed surface for the one generated-client call `callAsWallet` makes — see `polaris-oracle`'s `stellar.service.ts` for why the backend's own typed interfaces don't cover these (it never calls them directly; it only ever relayed a user's own signed call). */
type TradeContract = Record<
  TradeFunction,
  (args: Record<string, unknown>) => Promise<contract.AssembledTransaction<unknown>>
>;

/**
 * Contract specs are immutable per deployed WASM, so caching them by WASM
 * hash is safe and lets every market sharing one WASM reuse a single fetch.
 * Keyed by hash (not contract id) so a redeploy with a new WASM version
 * never collides with a stale spec. `contract.Client.from` is only called
 * on a cache miss; subsequent trades build `new contract.Client(spec, …)`
 * directly, skipping the extra RPC round trip and WASM download.
 */
const specCache = new Map<string, contract.Spec>();

async function getContractSpec(
  contractId: string,
  rpcUrl: string,
  networkPassphrase: string,
): Promise<contract.Spec> {
  const { contract, rpc } = await import('@stellar/stellar-sdk');
  const server = new rpc.Server(rpcUrl);
  const wasmHash = (await server.getContractWasmByContractId(contractId)).toString('hex');
  const cached = specCache.get(wasmHash);
  if (cached) return cached;

  // Cache miss: let the SDK fetch the spec once, then reuse it for every
  // other contract sharing this WASM hash.
  const client = await contract.Client.from({ contractId, rpcUrl, networkPassphrase });
  const spec = client.spec;
  specCache.set(wasmHash, spec);
  return spec;
}

/**
 * Runs a market/perpetual contract call authored by the connected wallet.
 *
 * The transaction is assembled and signed client-side (Freighter), then
 * submitted through the backend's relay so the app never needs to hold the
 * user's secret. Returns the transaction hash so callers can render a
 * "Confirmed — ref …" reference.
 *
 * A missing hash is treated as a hard error rather than an empty string: if
 * neither response shape carries a hash (SDK version drift, an unexpected
 * send path), the UI would otherwise claim "Confirmed" with a blank ref and
 * no way to look the transaction up. Throwing forces the caller to surface a
 * real failure instead of a false success.
 */
export async function callAsWallet(
  contractId: string,
  fn: TradeFunction,
  args: Record<string, unknown>,
  address: string,
): Promise<string> {
  const { contract, TransactionBuilder, Networks, BASE_FEE, nativeToScVal, Address } = await import(
    '@stellar/stellar-sdk'
  );
  const spec = await getContractSpec(contractId, config.rpcUrl, config.stellarNetworkPassphrase);
  const client = new contract.Client(spec, {
    contractId,
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.stellarNetworkPassphrase,
  });

  const wireArgs: Record<string, unknown> = { ...args };
  for (const field of I128_FIELDS) {
    if (field in wireArgs) {
      wireArgs[field] = nativeToScVal(wireArgs[field], { type: 'i128' });
    }
  }
  if (PREDICTION_FIELD in wireArgs) {
    wireArgs[PREDICTION_FIELD] = predictionScVal(String(wireArgs[PREDICTION_FIELD]));
  }
  wireArgs[AUTH_ADDRESS_PARAM] = new Address(address).toScVal();

  const tradeContract = client as unknown as TradeContract;
  const assembled = await tradeContract[fn](wireArgs);

  const signed = await withTimeout(
    assembled.sign({
      signTransaction: async (xdr: string) => {
        const { signedTxXdr, error } = await Freighter.signTransaction(xdr, {
          networkPassphrase: config.stellarNetworkPassphrase,
          address,
        });
        if (error) {
          if (isUserDeclined(error.message)) {
            throw new UserCancelledError();
          }
          throw new Error(error.message);
        }
        return { signedTxXdr };
      },
    }),
    SIGN_TIMEOUT_MS,
    'Freighter didn’t respond to the signing prompt — check the extension popup, or try again.',
  );

  const sent = await signed.send();
  const txHash = sent.sendTransactionResponse?.hash ?? sent.getTransactionResponse?.txHash;
  if (!txHash) {
    throw new Error(
      'Transaction was sent but no hash was returned — check your wallet history.',
    );
  }
  return txHash;
}
