import { describe, expect, it } from 'vitest';
import { estimateBuyOut, withSlippageTolerance } from './amm';

describe('estimateBuyOut', () => {
  it("matches the contract's own cpmm_out formula by hand", () => {
    // Cross-checked by hand against the contract's own cpmm_out formula:
    // pool_yes=pool_no=10_000, fee=100bps (1%), buy 1000 YES.
    // effective_in = 1000 - 1000*100/10000 = 990
    // k = 10_000*10_000 = 100_000_000
    // new_reserve_in = 10_000+990 = 10_990
    // new_reserve_out = 100_000_000 / 10_990 = 9_099 (floor)
    // amount_out = 10_000 - 9_099 = 901
    expect(estimateBuyOut('Yes', 1_000n, 10_000n, 10_000n, 100)).toBe(901n);
  });

  it('mirrors YES/NO symmetrically against a symmetric pool', () => {
    expect(estimateBuyOut('No', 1_000n, 10_000n, 10_000n, 100)).toBe(901n);
  });

  it('gives a larger trade a worse per-unit price (real slippage, not a flat rate)', () => {
    const smallOut = estimateBuyOut('Yes', 100n, 10_000n, 10_000n, 100);
    const bigOut = estimateBuyOut('Yes', 10_000n, 10_000n, 10_000n, 100);
    // Compare output-per-collateral ratios without floating point:
    // smallOut/100 vs bigOut/10_000, cross-multiplied.
    expect(smallOut * 10_000n > bigOut * 100n).toBe(true);
  });
});

describe('withSlippageTolerance', () => {
  it('applies a bps tolerance as a floor under an estimate', () => {
    expect(withSlippageTolerance(901n, 200)).toBe((901n * 9_800n) / 10_000n);
  });

  it('is a no-op at 0% tolerance', () => {
    expect(withSlippageTolerance(901n, 0)).toBe(901n);
  });
});
