// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, getButton, render, text, type } from '@/test/render';

// Pin the timezone before anything constructs a Date so the expiry
// conversion (local datetime -> unix seconds) is deterministic.
process.env.TZ = 'America/New_York';

const m = vi.hoisted(() => ({ createMarket: vi.fn(), push: vi.fn() }));

vi.mock('@/lib/api', () => ({ api: { createMarket: m.createMarket } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: m.push }) }));
vi.mock('@/lib/use-admin-key', async () => {
  const { useState } = await import('react');
  return {
    useAdminKey: () => {
      const [adminKey, setAdminKey] = useState('');
      return { adminKey, setAdminKey };
    },
  };
});

let CreateMarketPage: typeof import('./page').default;
beforeAll(async () => {
  CreateMarketPage = (await import('./page')).default;
});

const inputs = () => Array.from(document.querySelectorAll('input')) as HTMLInputElement[];

async function fillAndSubmit() {
  await render(<CreateMarketPage />);
  const [adminKey, strike, expiry, grace, baseFee, minFee, liquidity] = inputs();
  await type(adminKey, 'secret-admin');
  await type(strike, '0.17');
  await type(expiry, '2026-03-15T14:30');
  await type(grace, '45');
  await type(baseFee, '150');
  await type(minFee, '25');
  await type(liquidity, '2500.5');
  const form = document.querySelector('form')!;
  const { act } = await import('react');
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  m.createMarket.mockReset();
  m.push.mockReset();
});
afterEach(cleanup);

describe('CreateMarketPage', () => {
  it('builds the exact createMarket payload and redirects on success', async () => {
    m.createMarket.mockResolvedValue({ contractId: 'CNEW' });
    await fillAndSubmit();

    expect(m.createMarket).toHaveBeenCalledTimes(1);
    const [adminKey, payload] = m.createMarket.mock.calls[0];
    expect(adminKey).toBe('secret-admin');
    expect(payload.strikePriceCents).toBe('17'); // USD -> cents, as a string
    // 2026-03-15 14:30 America/New_York is EDT (UTC-4) -> 18:30Z, in seconds not ms
    expect(payload.expiry).toBe(Date.UTC(2026, 2, 15, 18, 30) / 1000);
    expect(payload.expiry).toBe(1773599400);
    expect(payload.gracePeriodSecs).toBe(2700); // 45 min -> seconds
    expect(payload.baseFeeBps).toBe(150);
    expect(payload.minFeeBps).toBe(25);
    expect(payload.initialLiquidityStroops).toBe('25005000000'); // XLM -> stroops
    expect(Object.keys(payload).sort()).toEqual(
      ['baseFeeBps', 'expiry', 'gracePeriodSecs', 'initialLiquidityStroops', 'minFeeBps', 'strikePriceCents'],
    );

    expect(m.push).toHaveBeenCalledWith('/market/CNEW');
  });

  it('shows the error and does not redirect on failure', async () => {
    m.createMarket.mockRejectedValue(new Error('admin key rejected'));
    await fillAndSubmit();

    expect(text()).toContain('admin key rejected');
    expect(m.push).not.toHaveBeenCalled();
    expect(getButton('Deploy market').disabled).toBe(false);
  });
});

