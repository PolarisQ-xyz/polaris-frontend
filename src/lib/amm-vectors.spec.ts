import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/amm-vectors.json';
import { estimateBuyOut } from './amm';

describe('estimateBuyOut golden vectors (polaris-contracts ctf-math)', () => {
  it('records the contract commit it was generated from', () => {
    expect(fixture._provenance.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(fixture.vectors.length).toBeGreaterThanOrEqual(50);
  });

  it.each(fixture.vectors)(
    'buy $prediction $amount @ yes=$poolYes no=$poolNo fee=$feeBps → $sharesOut',
    (v) => {
      const out = estimateBuyOut(
        v.prediction as 'Yes' | 'No',
        BigInt(v.amount),
        BigInt(v.poolYes),
        BigInt(v.poolNo),
        v.feeBps,
      );
      expect(out).toBe(BigInt(v.sharesOut));
    },
  );
});
