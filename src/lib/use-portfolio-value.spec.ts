// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from './test-utils/render-hook';
import { usePortfolioValue } from './use-portfolio-value';

vi.mock('./api', () => ({
  api: {
    listMarkets: vi.fn(),
    listPerpetuals: vi.fn(),
    getMarketState: vi.fn(),
    getPosition: vi.fn(),
    getPrice: vi.fn(),
    getPerpetualState: vi.fn(),
    getPerpetualPosition: vi.fn(),
    getPerpetualPrice: vi.fn(),
  },
}));
vi.mock('./wallet-provider', () => ({ useWallet: vi.fn() }));

const { api } = await import('./api');
const { useWallet } = await import('./wallet-provider');
const m = vi.mocked(api);

type Row = { status: string; yes: string; no: string; yesBps?: number; noBps?: number; error?: boolean };

/** Wires the mocked api so each contract id answers from `markets`/`perps`. */
function setup(markets: Record<string, Row>, perps: Record<string, Row> = {}) {
  m.listMarkets.mockResolvedValue(Object.keys(markets).map((contractId) => ({ contractId })) as never);
  m.listPerpetuals.mockResolvedValue(Object.keys(perps).map((contractId) => ({ contractId })) as never);
  const wire = (rows: Record<string, Row>, state: typeof m.getMarketState, pos: typeof m.getPosition, price: typeof m.getPrice) => {
    state.mockImplementation(async (id) => {
      if (rows[id].error) throw new Error('boom');
      return { status: rows[id].status } as never;
    });
    pos.mockImplementation(async (id) => ({ yes: rows[id].yes, no: rows[id].no }) as never);
    price.mockImplementation(async (id) => ({ yesBps: rows[id].yesBps!, noBps: rows[id].noBps! }) as never);
  };
  wire(markets, m.getMarketState, m.getPosition, m.getPrice);
  wire(perps, m.getPerpetualState as never, m.getPerpetualPosition as never, m.getPerpetualPrice as never);
}

describe('usePortfolioValue', () => {
  let unmount: (() => void) | undefined;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWallet).mockReturnValue({ wallet: { address: 'GUSER' } } as never);
  });
  afterEach(() => unmount?.());

  async function settle() {
    const r = renderHook(() => usePortfolioValue());
    unmount = r.unmount;
    await waitFor(() => expect(r.result.current).not.toBeNull());
    return r.result.current!;
  }

  it('returns null with no wallet connected', async () => {
    vi.mocked(useWallet).mockReturnValue({ wallet: null } as never);
    setup({});
    const r = renderHook(() => usePortfolioValue());
    unmount = r.unmount;
    await new Promise((res) => setTimeout(res, 50));
    expect(r.result.current).toBeNull();
    expect(m.listMarkets).not.toHaveBeenCalled();
  });

  it('marks an open market to market at known odds', async () => {
    // 1000 YES @ 6000bps + 500 NO @ 4000bps = 600 + 200
    setup({ A: { status: 'Open', yes: '1000', no: '500', yesBps: 6000, noBps: 4000 } });
    expect(await settle()).toEqual({ total: 800n, hasPosition: true });
  });

  it('values a ResolvedYes winner at its YES balance only', async () => {
    setup({ A: { status: 'ResolvedYes', yes: '1234', no: '99' } });
    expect(await settle()).toEqual({ total: 1234n, hasPosition: true });
    expect(m.getPrice).not.toHaveBeenCalled();
  });

  it('pays a Cancelled market 0.5 per share on either side', async () => {
    setup({ A: { status: 'Cancelled', yes: '301', no: '100' } });
    expect(await settle()).toEqual({ total: 200n, hasPosition: true }); // (301+100)/2 floored
  });

  it('pays a terminated perpetual with the Cancelled formula, summed with markets', async () => {
    setup(
      { A: { status: 'ResolvedNo', yes: '10', no: '40' } },
      { P: { status: 'Terminated', yes: '700', no: '301' } },
    );
    expect(await settle()).toEqual({ total: 40n + 500n, hasPosition: true });
    expect(m.getPerpetualPrice).not.toHaveBeenCalled();
  });

  it('marks an open perpetual to market', async () => {
    setup({}, { P: { status: 'Open', yes: '3333', no: '0', yesBps: 3000, noBps: 7000 } });
    expect(await settle()).toEqual({ total: 999n, hasPosition: true }); // 3333*3000/10000 floored
  });

  it('reports hasPosition false when every balance is zero', async () => {
    setup({ A: { status: 'Open', yes: '0', no: '0' } }, { P: { status: 'Open', yes: '0', no: '0' } });
    expect(await settle()).toEqual({ total: 0n, hasPosition: false });
    expect(m.getPrice).not.toHaveBeenCalled();
  });

  it('counts an errored row as 0 without hiding the others', async () => {
    setup({
      A: { status: 'ResolvedYes', yes: '500', no: '0' },
      B: { status: 'Open', yes: '1', no: '1', error: true },
    });
    expect(await settle()).toEqual({ total: 500n, hasPosition: true });
  });
});
