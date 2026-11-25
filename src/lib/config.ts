// Reads (market list, odds, positions, balances) stay backend-mediated
// through polaris-oracle's REST API — see lib/api.ts. Trade signing and
// submission do not: a connected wallet (Freighter) builds, simulates,
// signs, and sends its own transactions directly against Soroban RPC — see
// lib/freighter-wallet.ts. Both RPC values below are public network
// parameters, not secrets — safe to bake in as defaults the same way
// oracleUrl already is.
//
// NEXT_PUBLIC_* values are inlined at build time. In a production build we
// must not silently fall back to localhost/testnet defaults: a Vercel
// environment missing a variable would otherwise ship a site that either
// can't reach any backend or mixes a mainnet oracle with a testnet
// RPC/passphrase. So defaults are kept for `next dev` only; a production
// build throws (at module load, i.e. build time) naming each missing var.
const isProduction = process.env.NODE_ENV === 'production';

const oracleUrl = process.env.NEXT_PUBLIC_ORACLE_URL;
const stellarRpcUrl = process.env.NEXT_PUBLIC_STELLAR_RPC_URL;
const stellarNetworkPassphrase = process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE;

if (isProduction) {
  const missing: string[] = [];
  if (!oracleUrl) missing.push('NEXT_PUBLIC_ORACLE_URL');
  if (!stellarRpcUrl) missing.push('NEXT_PUBLIC_STELLAR_RPC_URL');
  if (!stellarNetworkPassphrase) missing.push('NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE');
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable${missing.length > 1 ? 's' : ''} for a production build: ${missing.join(', ')}. ` +
        'Set them explicitly (e.g. in your Vercel project settings or CI) — production builds do not fall back to localhost/testnet defaults.',
    );
  }
}

export const config = {
  oracleUrl: process.env.NEXT_PUBLIC_ORACLE_URL ?? 'http://localhost:3001',
  stellarRpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org',
  stellarNetworkPassphrase:
    process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015',
};

// Shared passphrase→network-name mapping. Used both by the wrong-network
// message and by block-explorer link derivation so the two never drift.
const NETWORK_NAMES: Record<string, string> = {
  'Public Global Stellar Network ; September 2015': 'public',
  'Test SDF Network ; September 2015': 'testnet',
  'Test SDF Future Network ; October 2022': 'futurenet',
};

export function networkNameFromPassphrase(passphrase: string): string {
  return NETWORK_NAMES[passphrase] ?? 'testnet';
}

// Human-readable display names for known passphrases, used in user-facing
// messages (e.g. the Freighter wrong-network error). Falls back to the raw
// passphrase for unknown values so the message never lies about the target.
const NETWORK_DISPLAY_NAMES: Record<string, string> = {
  'Public Global Stellar Network ; September 2015': 'Mainnet',
  'Test SDF Network ; September 2015': 'Testnet',
  'Test SDF Future Network ; October 2022': 'Futurenet',
};

export function networkDisplayNameFromPassphrase(passphrase: string): string {
  return NETWORK_DISPLAY_NAMES[passphrase] ?? passphrase;
}

export function explorerTxUrl(hash: string): string {
  const network = networkNameFromPassphrase(config.stellarNetworkPassphrase);
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}
