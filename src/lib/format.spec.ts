import { describe, it, expect } from 'vitest';
import { stroopsToXlm, formatCountdown } from './format';

describe('stroopsToXlm', () => {
  it('formats zero', () => {
    expect(stroopsToXlm(0n)).toBe('0.00');
  });

  it('formats whole amounts', () => {
    expect(stroopsToXlm(10_000_000n)).toBe('1.00');
  });

  it('formats fractional amounts', () => {
    expect(stroopsToXlm(12_345_678n)).toBe('1.23');
  });

  it('pads small fractions', () => {
    expect(stroopsToXlm(1n)).toBe('0.00');
  });

  it('respects fractionDigits', () => {
    expect(stroopsToXlm(12_345_678n, 4)).toBe('1.2345');
  });

  it('formats negative whole amounts', () => {
    expect(stroopsToXlm(-10_000_000n)).toBe('-1.00');
  });

  it('formats negative fractional amounts', () => {
    expect(stroopsToXlm(-12_345_678n)).toBe('-1.23');
  });

  it('formats small negative amounts', () => {
    expect(stroopsToXlm(-1n)).toBe('0.00');
  });

  it('respects fractionDigits for negative amounts', () => {
    expect(stroopsToXlm(-12_345_678n, 4)).toBe('-1.2345');
  });
});

describe('formatCountdown', () => {
  it('returns expired for zero or negative diff', () => {
    expect(formatCountdown(0)).toBe('expired');
    expect(formatCountdown(-1)).toBe('expired');
    expect(formatCountdown(-60_000)).toBe('expired');
  });

  it('renders seconds for the final sub-minute', () => {
    expect(formatCountdown(42_000)).toBe('42s');
    expect(formatCountdown(1_000)).toBe('1s');
    expect(formatCountdown(59_000)).toBe('59s');
  });

  it('renders minutes for durations of 60s or more', () => {
    expect(formatCountdown(60_000)).toBe('1m');
    expect(formatCountdown(90_000)).toBe('1m');
    expect(formatCountdown(59 * 60_000)).toBe('59m');
  });

  it('renders hours and minutes for durations of an hour or more', () => {
    expect(formatCountdown(60 * 60_000)).toBe('1h 0m');
    expect(formatCountdown(90 * 60_000)).toBe('1h 30m');
  });
});
