'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatStroops, isDisplayCurrency, type DisplayCurrency } from '@/lib/format';

/** localStorage key for the persisted display-currency preference (#47). */
export const DISPLAY_CURRENCY_KEY = 'polaris.displayCurrency';
export const DEFAULT_DISPLAY_CURRENCY: DisplayCurrency = 'xlm';

/** Storage can be unavailable (private mode, blocked site data) or hold junk; fall back to the default. */
export function readDisplayCurrency(storage?: Pick<Storage, 'getItem'>): DisplayCurrency {
  try {
    const store = storage ?? window.localStorage;
    const value = store.getItem(DISPLAY_CURRENCY_KEY);
    return isDisplayCurrency(value) ? value : DEFAULT_DISPLAY_CURRENCY;
  } catch {
    return DEFAULT_DISPLAY_CURRENCY;
  }
}

export function writeDisplayCurrency(currency: DisplayCurrency, storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? window.localStorage).setItem(DISPLAY_CURRENCY_KEY, currency);
  } catch {
    // The preference still applies for this session.
  }
}

/** The ticker endpoint's body is untyped; accept only a positive finite `priceCents`. */
export function parsePriceCents(ticker: unknown): number | null {
  if (typeof ticker !== 'object' || ticker === null) return null;
  const cents = (ticker as { priceCents?: unknown }).priceCents;
  return typeof cents === 'number' && Number.isFinite(cents) && cents > 0 ? cents : null;
}

interface DisplayCurrencyValue {
  currency: DisplayCurrency;
  setCurrency: (currency: DisplayCurrency) => void;
  /** XLM/USD in cents, only fetched while `usd` is selected; null until known. */
  xlmUsdCents: number | null;
}

// Outside the provider (e.g. isolated component specs) everything renders in XLM, as before.
const DisplayCurrencyContext = createContext<DisplayCurrencyValue>({
  currency: DEFAULT_DISPLAY_CURRENCY,
  setCurrency: () => {},
  xlmUsdCents: null,
});

export function DisplayCurrencyProvider({ children }: { children: React.ReactNode }) {
  // Start on the default and restore after mount so server and first client render match.
  const [currency, setCurrencyState] = useState<DisplayCurrency>(DEFAULT_DISPLAY_CURRENCY);

  useEffect(() => {
    setCurrencyState(readDisplayCurrency());
    const onStorage = (e: StorageEvent) => {
      if (e.key === DISPLAY_CURRENCY_KEY) setCurrencyState(readDisplayCurrency());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setCurrency = useCallback((next: DisplayCurrency) => {
    setCurrencyState(next);
    writeDisplayCurrency(next);
  }, []);

  // Rate source: the price feed of any listed market (every market is XLM/USD).
  const { data: markets } = useQuery({
    queryKey: ['markets'],
    queryFn: api.listMarkets,
    enabled: currency === 'usd',
  });
  const feedId = markets?.[0]?.feedId;
  const { data: ticker } = useQuery({
    queryKey: ['display-currency-rate', feedId],
    queryFn: () => api.getTickerPrice(String(feedId)),
    enabled: currency === 'usd' && feedId !== undefined,
    refetchInterval: 60_000,
  });
  const xlmUsdCents = parsePriceCents(ticker);

  const value = useMemo(() => ({ currency, setCurrency, xlmUsdCents }), [currency, setCurrency, xlmUsdCents]);
  return <DisplayCurrencyContext.Provider value={value}>{children}</DisplayCurrencyContext.Provider>;
}

export function useDisplayCurrency(): DisplayCurrencyValue {
  return useContext(DisplayCurrencyContext);
}

/** `formatStroops` bound to the user's preference and the live XLM/USD rate. */
export function useFormatStroops(): (stroops: string | bigint) => string {
  const { currency, xlmUsdCents } = useDisplayCurrency();
  return useCallback((stroops) => formatStroops(stroops, currency, xlmUsdCents), [currency, xlmUsdCents]);
}
