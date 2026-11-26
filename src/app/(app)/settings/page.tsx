'use client';

import { Card, CardBody } from '@/components/ui/card';
import { useDisplayCurrency } from '@/lib/display-currency';
import { DISPLAY_CURRENCIES, DISPLAY_CURRENCY_LABELS, formatStroops } from '@/lib/format';

const EXAMPLE_STROOPS = 123_456_789n;

export default function SettingsPage() {
  const { currency, setCurrency, xlmUsdCents } = useDisplayCurrency();

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Settings</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">Preferences are saved in this browser.</p>

      <Card>
        <CardBody>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">Display currency</legend>
            <p className="mb-3 text-xs text-[var(--muted)]">
              How balances and payouts are shown. Trades always settle in XLM; USD is an estimate from the
              live XLM/USD price.
            </p>
            <div className="space-y-2">
              {DISPLAY_CURRENCIES.map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="display-currency"
                    value={c}
                    checked={currency === c}
                    onChange={() => setCurrency(c)}
                  />
                  {DISPLAY_CURRENCY_LABELS[c]}
                </label>
              ))}
            </div>
            <p className="mt-4 text-xs text-[var(--muted)]">
              Preview: <span className="font-mono">{formatStroops(EXAMPLE_STROOPS, currency, xlmUsdCents)}</span>
            </p>
          </fieldset>
        </CardBody>
      </Card>
    </div>
  );
}
