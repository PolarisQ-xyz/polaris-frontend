// @vitest-environment jsdom
import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EmbedMarketPage from './page';
import { estimateBuyOut, withSlippageTolerance } from '@/lib/amm';
import { cleanup, click, getButton, render, text } from '@/test/render';

const m = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  walletCtx: {} as Record<string, unknown>,
  callAsWallet: vi.fn(),
  nextRound: undefined as undefined | { contractId: string },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey, enabled = true }: { queryKey: string[]; enabled?: boolean }) => ({
    data: enabled ? m.queries[queryKey[0]] : undefined,
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('@/lib/api', () => ({ api: {}, messageFromApiError: (e: Error) => e.message }));
vi.mock('@/lib/wallet-provider', () => ({ useWallet: () => m.walletCtx }));
vi.mock('@/lib/freighter-wallet', () => ({ callAsWallet: m.callAsWallet }));
vi.mock('@/lib/use-next-round', () => ({ useNextRound: () => m.nextRound }));
vi.mock('@/components/auth-controls', () => ({
  AuthControls: ({ compact }: { compact?: boolean }) => <div data-testid="auth-controls" data-compact={String(!!compact)} />,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const XLM = 10_000_000n;
const ID = 'CMARKET';
const wallet = { kind: 'freighter' as const, address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV' };

function renderPage() {
  return render(
    <Suspense fallback={<p>suspended</p>}>
      <EmbedMarketPage params={Promise.resolve({ id: ID })} />
    </Suspense>,
  );
}

const openQueries = () => ({
  market: { contractId: ID, status: 'watching', strikePriceCents: '15' },
  price: { yesBps: 5000, noBps: 5000 },
  state: { status: 'Open', poolYes: (500n * XLM).toString(), poolNo: (500n * XLM).toString() },
  fee: { feeBps: 100 },
});

beforeEach(() => {
  m.nextRound = undefined;
  m.walletCtx = { wallet, connecting: false, error: null, freighterAvailable: true, connectWallet: vi.fn() };
  m.callAsWallet.mockReset().mockResolvedValue({ txHash: 'abcdef1234567890abcdef' });
});
afterEach(cleanup);

describe('EmbedMarketPage', () => {
  it('shows Loading… then the widget once the market loads', async () => {
    m.queries = {};
    await renderPage();
    expect(text()).toContain('Loading…');

    m.queries = openQueries();
    await renderPage();
    expect(text()).toContain('XLM ≥');
    expect(getButton('Buy Yes')).toBeTruthy();
  });

  it('closed market with a position: compact reveal with an /embed/ next-round href', async () => {
    m.queries = {
      market: { contractId: ID, status: 'resolved', strikePriceCents: '15' },
      state: { status: 'ResolvedYes', poolYes: '0', poolNo: '0' },
      position: { yes: (3n * XLM).toString(), no: '0' },
    };
    m.nextRound = { contractId: 'CNEXT' };
    await renderPage();

    expect(document.querySelector('.result-reveal--compact')).not.toBeNull();
    expect(text()).toContain('You won');
    const href = document.querySelector('a.result-reveal__next')?.getAttribute('href');
    expect(href).toBe('/embed/CNEXT');
    expect(href?.startsWith('/embed/')).toBe(true);
  });

  it('wallet error: shows "Try email instead" which switches to compact AuthControls', async () => {
    m.queries = openQueries();
    m.walletCtx = { ...m.walletCtx, wallet: null, error: 'User declined access' };
    await renderPage();

    expect(document.querySelector('[data-testid="auth-controls"]')).toBeNull();
    await click(getButton('Try email instead'));
    const auth = document.querySelector('[data-testid="auth-controls"]');
    expect(auth?.getAttribute('data-compact')).toBe('true');
    expect(text()).not.toContain('Try email instead');
  });

  it('buy calls callAsWallet with the same args TradeCard uses', async () => {
    m.queries = openQueries();
    await renderPage();
    await click(getButton('Buy Yes'));

    const stroops = 10n * XLM;
    const minOut = withSlippageTolerance(estimateBuyOut('Yes', stroops, 500n * XLM, 500n * XLM, 100), 200);
    expect(m.callAsWallet).toHaveBeenCalledWith(wallet, ID, 'buy', {
      prediction: 'Yes',
      collateral_amount: stroops.toString(),
      min_shares_out: minOut.toString(),
    });
    expect(m.callAsWallet.mock.calls[0]).toHaveLength(4);
  });
});
