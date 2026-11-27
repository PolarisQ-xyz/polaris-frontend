import { describe, expect, it } from 'vitest';
import { MAX_FEE_BPS, validateFeeFields } from './create-market-validation';

const valid = { graceMins: '60', baseFeeBps: '100', minFeeBps: '20' };

describe('validateFeeFields', () => {
  it('accepts the page defaults unchanged (#100)', () => {
    expect(validateFeeFields(valid)).toEqual({
      ok: true,
      values: { gracePeriodSecs: 3600, baseFeeBps: 100, minFeeBps: 20 },
    });
  });

  it.each(['', '   ', 'abc', '1.5', '-5', '1e3', 'NaN'])(
    'rejects %j for every field with a field-specific message (#99)',
    (bad) => {
      const result = validateFeeFields({ graceMins: bad, baseFeeBps: bad, minFeeBps: bad });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors.graceMins).toMatch(/grace period/i);
      expect(result.errors.baseFeeBps).toMatch(/base fee/i);
      expect(result.errors.minFeeBps).toMatch(/min fee/i);
    },
  );

  it('rejects a zero grace period', () => {
    const result = validateFeeFields({ ...valid, graceMins: '0' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.graceMins).toMatch(/at least 1 minute/);
  });

  it('rejects an inverted fee curve and explains its direction (#100)', () => {
    const result = validateFeeFields({ ...valid, baseFeeBps: '100', minFeeBps: '500' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.minFeeBps).toMatch(/at or below the base fee/);
      expect(result.errors.minFeeBps).toMatch(/decays/);
      expect(result.errors.baseFeeBps).toBeUndefined();
    }
  });

  it('rejects fees above 10000 bps (#100)', () => {
    const result = validateFeeFields({ ...valid, baseFeeBps: '15000', minFeeBps: '10001' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.baseFeeBps).toMatch(String(MAX_FEE_BPS));
      expect(result.errors.minFeeBps).toMatch(String(MAX_FEE_BPS));
    }
  });

  it('accepts the boundaries 0 ≤ min = base = 10000 and min = 0', () => {
    expect(validateFeeFields({ ...valid, baseFeeBps: '10000', minFeeBps: '10000' }).ok).toBe(true);
    expect(validateFeeFields({ ...valid, baseFeeBps: '0', minFeeBps: '0' }).ok).toBe(true);
  });

  it('never produces NaN or null values', () => {
    const result = validateFeeFields({ graceMins: ' 45 ', baseFeeBps: '150', minFeeBps: '25' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const value of Object.values(result.values)) expect(Number.isFinite(value)).toBe(true);
      expect(JSON.stringify(result.values)).not.toContain('null');
    }
  });
});
