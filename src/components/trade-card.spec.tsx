// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { byText, cleanup, click, flush, render } from '@/test/render';
import { estimateBuyOut, withSlippageTolerance } from '@/lib/amm';

vi.mock('@/lib/wallet-provider', () => ({ useWallet: vi.fn() }));
vi.mock('@/lib/freighter-wallet', () => ({ callAsWallet: vi.fn() }));
vi.mock('@/lib/use-next-round', () => ({ useNextRound: () => undefined }));
vi.mock('@/components/result-reveal', () => ({ ResultReveal: () => null }));
vi.mock('@/lib/api', () => ({
  api: { getMarket: vi.fn(), getMarketState: vi.fn(), getFee: vi.fn(), getPosition: vi.fn() },
  messageFromApiError: (err: unknown) => (err as Error).message,
}));

import { api } from '@/lib/api';
import { useWallet } from '@/lib/wallet-provider';
import { callAsWallet } from '@/lib/freighter-wallet';
import { TradeCard } from './trade-card';

const WALLET = { kind: 'freighter', address: 'GWALLET' } as const;
const POOL_YES = 500_000_000n;
const POOL_NO = 300_000_000n;
const FEE_BPS = 100;
const STAKE = 100_000_000n; // the default 10 XLM in stroops

let connectWallet: ReturnType<typeof vi.fn>;
function setWallet(wallet: typeof WALLET | null) {
  connectWallet = vi.fn();
  vi.mocked(useWallet).mockImplementation(() => ({ wallet, connecting: false, error: null, connectWallet }) as never);
}

const mount = (props: Partial<Parameters<typeof TradeCard>[0]> = {}) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TradeCard marketId="MKT" {...props} />
    </QueryClientProvider>,
  );

const expectedBuyArgs = {
  prediction: 'Yes',
  collateral_amount: STAKE.toString(),
  min_shares_out: withSlippageTolerance(estimateBuyOut('Yes', STAKE, POOL_YES, POOL_NO, FEE_BPS), 200).toString(),
};

beforeEach(() => {
  vi.mocked(api.getMarket).mockResolvedValue({ status: 'watching' } as never);
  vi.mocked(api.getMarketState).mockImplementation(async (id: string) =>
    (id === 'OLD'
      ? { status: 'ResolvedYes', poolYes: '0', poolNo: '0' }
      : { status: 'Open', poolYes: POOL_YES.toString(), poolNo: POOL_NO.toString() }) as never,
  );
  vi.mocked(api.getFee).mockResolvedValue({ feeBps: FEE_BPS } as never);
  vi.mocked(api.getPosition).mockResolvedValue({ yes: '0', no: '0' } as never);
  vi.mocked(callAsWallet).mockResolvedValue({ txHash: 'TXHASH' } as never);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TradeCard buy', () => {
  it('sends the exact collateral_amount and slippage-floored min_shares_out', async () => {
    setWallet(WALLET);
    const { container } = await mount();
    await flush();
    await click(byText(container, 'Buy Yes'));
    await flush();
    expect(callAsWallet).toHaveBeenCalledTimes(1);
    expect(callAsWallet).toHaveBeenCalledWith(WALLET, 'MKT', 'buy', expectedBuyArgs);
  });

  it('with no wallet, connects first and then buys with the returned wallet', async () => {
    setWallet(null);
    const { container } = await mount();
    connectWallet.mockResolvedValue(WALLET);
    await flush();
    await click(byText(container, 'Buy Yes'));
    await flush();
    expect(connectWallet).toHaveBeenCalled();
    expect(callAsWallet).toHaveBeenCalledWith(WALLET, 'MKT', 'buy', expectedBuyArgs);
  });

  it('aborts without calling the contract when connectWallet returns null', async () => {
    setWallet(null);
    const { container } = await mount();
    connectWallet.mockResolvedValue(null);
    await flush();
    await click(byText(container, 'Buy Yes'));
    await flush();
    expect(connectWallet).toHaveBeenCalled();
    expect(callAsWallet).not.toHaveBeenCalled();
  });
});

describe('TradeCard rollover', () => {
  it('redeems the predecessor, then buys the redeemed amount, in that order', async () => {
    setWallet(WALLET);
    vi.mocked(api.getPosition).mockImplementation(async (id: string) =>
      (id === 'OLD' ? { yes: STAKE.toString(), no: '0' } : { yes: '0', no: '0' }) as never,
    );
    const { container } = await mount({ rolloverFromMarketId: 'OLD' });
    await flush();
    await click(byText(container, 'Buy Yes'));
    await flush();
    expect(vi.mocked(callAsWallet).mock.calls).toEqual([
      [WALLET, 'OLD', 'redeem', {}],
      [WALLET, 'MKT', 'buy', expectedBuyArgs],
    ]);
  });
});

describe('TradeCard redeem', () => {
  beforeEach(() => {
    vi.mocked(api.getMarket).mockResolvedValue({ status: 'resolved' } as never);
    vi.mocked(api.getMarketState).mockResolvedValue({ status: 'ResolvedYes', poolYes: '0', poolNo: '0' } as never);
  });

  it('shows Redeem when redeemableValue > 0 and calls redeem with exact args', async () => {
    setWallet(WALLET);
    vi.mocked(api.getPosition).mockResolvedValue({ yes: '50000000', no: '0' } as never);
    const { container } = await mount();
    await flush();
    await click(byText(container, 'Redeem'));
    await flush();
    expect(callAsWallet).toHaveBeenCalledWith(WALLET, 'MKT', 'redeem', {});
  });

  it('hides Redeem when the position is on the losing side', async () => {
    setWallet(WALLET);
    vi.mocked(api.getPosition).mockResolvedValue({ yes: '0', no: '50000000' } as never);
    const { container } = await mount();
    await flush();
    expect(byText(container, 'Redeem')).toBeNull();
  });
});
