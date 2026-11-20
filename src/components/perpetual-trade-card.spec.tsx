// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PerpetualTradeCard } from './perpetual-trade-card';
import { estimateBuyOut, withSlippageTolerance } from '@/lib/amm';
import { cleanup, click, getButton, queryButton, render, text } from '@/test/render';

const m = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  wallet: null as null | { kind: 'freighter' | 'email'; address: string },
  callAsWallet: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey, enabled = true }: { queryKey: string[]; enabled?: boolean }) => ({
    data: enabled ? m.queries[queryKey[0]] : undefined,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@/lib/api', () => ({ api: {}, messageFromApiError: (e: Error) => e.message }));
vi.mock('@/lib/wallet-provider', () => ({
  useWallet: () => ({ wallet: m.wallet, connecting: false, error: null, connectWallet: vi.fn() }),
}));
vi.mock('@/lib/freighter-wallet', () => ({ callAsWallet: m.callAsWallet }));

const XLM = 10_000_000n;
const ID = 'CPERP';
const wallet = { kind: 'email' as const, address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV' };

function setup(status: 'watching' | 'terminated', position?: { yes: string; no: string }) {
  m.queries = {
    perpetual: { contractId: ID, status },
    perpetualState: { poolYes: (500n * XLM).toString(), poolNo: (500n * XLM).toString() },
    perpetualFee: status === 'watching' ? { feeBps: 100 } : undefined,
    perpetualPosition: position,
  };
}

beforeEach(() => {
  m.wallet = wallet;
  m.callAsWallet.mockReset().mockResolvedValue({ txHash: 'abcdef1234567890abcdef' });
});
afterEach(cleanup);

describe('PerpetualTradeCard', () => {
  it('open: shows the buy form and buys with contractKind "perpetual"', async () => {
    setup('watching');
    await render(<PerpetualTradeCard perpetualId={ID} />);
    expect(text()).toContain('Amount (XLM)');
    expect(text()).not.toContain('Trading is closed');

    await click(getButton('Buy Yes'));

    const stroops = 10n * XLM;
    const minOut = withSlippageTolerance(estimateBuyOut('Yes', stroops, 500n * XLM, 500n * XLM, 100), 200);
    expect(m.callAsWallet).toHaveBeenCalledWith(
      wallet,
      ID,
      'buy',
      { prediction: 'Yes', collateral_amount: stroops.toString(), min_shares_out: minOut.toString() },
      'perpetual',
    );
  });

  it('terminated with a position: shows 0.5/share copy and redeems with contractKind "perpetual"', async () => {
    setup('terminated', { yes: (4n * XLM).toString(), no: '0' });
    await render(<PerpetualTradeCard perpetualId={ID} />);
    expect(text()).toContain(
      'This market has been terminated. Every position pays 0.5 XLM per share, regardless of side.',
    );
    expect(text()).not.toContain('Amount (XLM)');

    await click(getButton('Redeem'));
    expect(m.callAsWallet).toHaveBeenCalledWith(wallet, ID, 'redeem', {}, 'perpetual');
  });

  it('terminated without a position: "Trading is closed" and no Redeem', async () => {
    setup('terminated', { yes: '0', no: '0' });
    await render(<PerpetualTradeCard perpetualId={ID} />);
    expect(text()).toContain('Trading is closed.');
    expect(queryButton('Redeem')).toBeUndefined();
  });
});
