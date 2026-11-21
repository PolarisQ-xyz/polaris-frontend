/**
 * Which wire-arg key holds the i128 amount(s) for each sponsorable
 * function, and which key is the `Prediction` enum, if any — the frontend
 * equivalent of `wire-args.ts`'s per-function field knowledge, since the
 * browser builds and signs its own transaction now instead of asking the
 * backend to. Keep in sync with that file's `AUTH_ADDRESS_PARAM`/switch.
 *
 * Lives apart from `freighter-wallet.ts` (no browser deps) so
 * `trade-args.spec.ts` can check it against the contracts' checked-in
 * interface spec — see `__fixtures__/README.md`.
 */
export const I128_FIELDS: Record<string, string[]> = {
  buy: ['collateral_amount', 'min_shares_out'],
  sell: ['shares_in', 'min_collateral_out'],
  split: ['amount'],
  merge: ['amount'],
  transfer: ['amount'],
  redeem: [],
};
export const PREDICTION_FIELD: Partial<Record<string, string>> = {
  buy: 'prediction',
  sell: 'prediction',
  transfer: 'prediction',
};
export const AUTH_ADDRESS_PARAM: Record<string, string> = {
  buy: 'user',
  sell: 'user',
  split: 'user',
  merge: 'user',
  redeem: 'user',
  transfer: 'from',
};

export type TradeFunction = 'buy' | 'sell' | 'split' | 'merge' | 'transfer' | 'redeem';
