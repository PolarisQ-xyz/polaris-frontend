/**
 * Client-side validation for the `/create` grace period and fee fields
 * (#99, #100). `Number('')` is `0` and `Number('abc')` is `NaN` — which
 * `JSON.stringify` sends as `null` — so the raw inputs are checked as strings
 * before any conversion, and nothing is submitted unless every field passes.
 */

/** 100% expressed in basis points. */
export const MAX_FEE_BPS = 10_000;

export type FeeField = 'graceMins' | 'baseFeeBps' | 'minFeeBps';

export interface FeeFieldInputs {
  graceMins: string;
  baseFeeBps: string;
  minFeeBps: string;
}

export interface FeeFieldValues {
  gracePeriodSecs: number;
  baseFeeBps: number;
  minFeeBps: number;
}

export type FeeFieldErrors = Partial<Record<FeeField, string>>;

const NON_NEGATIVE_INTEGER = /^\d+$/;

function parseNonNegativeInteger(raw: string): number | null {
  const trimmed = raw.trim();
  if (!NON_NEGATIVE_INTEGER.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * Returns either the converted payload values or a per-field error map —
 * never both. Rules: every field is a non-negative whole number, grace is at
 * least 1 minute, and the fee curve satisfies `0 ≤ min ≤ base ≤ 10000`.
 */
export function validateFeeFields(
  inputs: FeeFieldInputs,
): { ok: true; values: FeeFieldValues } | { ok: false; errors: FeeFieldErrors } {
  const errors: FeeFieldErrors = {};

  const grace = parseNonNegativeInteger(inputs.graceMins);
  if (grace === null) {
    errors.graceMins = 'Enter the grace period as a whole number of minutes.';
  } else if (grace < 1) {
    errors.graceMins = 'Grace period must be at least 1 minute, or the market can be cancelled the instant it expires.';
  }

  const base = parseNonNegativeInteger(inputs.baseFeeBps);
  if (base === null) {
    errors.baseFeeBps = 'Enter the base fee as a whole number of basis points.';
  } else if (base > MAX_FEE_BPS) {
    errors.baseFeeBps = `Base fee can't exceed ${MAX_FEE_BPS} bps (100%).`;
  }

  const min = parseNonNegativeInteger(inputs.minFeeBps);
  if (min === null) {
    errors.minFeeBps = 'Enter the min fee as a whole number of basis points.';
  } else if (min > MAX_FEE_BPS) {
    errors.minFeeBps = `Min fee can't exceed ${MAX_FEE_BPS} bps (100%).`;
  } else if (base !== null && base <= MAX_FEE_BPS && min > base) {
    errors.minFeeBps =
      'Min fee must be at or below the base fee — the fee starts at the base and decays toward the min as volume grows.';
  }

  if (Object.keys(errors).length > 0 || grace === null || base === null || min === null) {
    return { ok: false, errors };
  }
  return { ok: true, values: { gracePeriodSecs: grace * 60, baseFeeBps: base, minFeeBps: min } };
}
