import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISPLAY_CURRENCY,
  DISPLAY_CURRENCY_KEY,
  parsePriceCents,
  readDisplayCurrency,
  writeDisplayCurrency,
} from './display-currency';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe('display currency persistence', () => {
  it('defaults to XLM when nothing is stored', () => {
    expect(readDisplayCurrency(fakeStorage())).toBe(DEFAULT_DISPLAY_CURRENCY);
  });

  it('round-trips a saved preference', () => {
    const storage = fakeStorage();
    writeDisplayCurrency('usd', storage);
    expect(storage.data[DISPLAY_CURRENCY_KEY]).toBe('usd');
    expect(readDisplayCurrency(storage)).toBe('usd');
  });

  it('ignores an unknown stored value', () => {
    expect(readDisplayCurrency(fakeStorage({ [DISPLAY_CURRENCY_KEY]: 'eur' }))).toBe('xlm');
  });

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readDisplayCurrency(broken)).toBe('xlm');
    expect(() => writeDisplayCurrency('stroops', broken)).not.toThrow();
  });
});

describe('parsePriceCents', () => {
  it('reads a positive priceCents and rejects everything else', () => {
    expect(parsePriceCents({ priceCents: 25 })).toBe(25);
    expect(parsePriceCents({ priceCents: 0 })).toBeNull();
    expect(parsePriceCents({ priceCents: '25' })).toBeNull();
    expect(parsePriceCents(null)).toBeNull();
    expect(parsePriceCents(undefined)).toBeNull();
  });
});
