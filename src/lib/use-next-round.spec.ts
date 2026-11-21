// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WatchedMarket } from './api';
import { renderHook, sleep, waitFor } from './test-utils/render-hook';
import { useNextRound } from './use-next-round';

vi.mock('./api', () => ({ api: { listMarketsForFeed: vi.fn() } }));
vi.mock('./format', () => ({ RESOLUTION_POLL_MS: 20 }));

const { api } = await import('./api');
const listMarketsForFeed = vi.mocked(api.listMarketsForFeed);

function market(overrides: Partial<WatchedMarket>): WatchedMarket {
  return {
    contractId: 'C',
    strikePriceCents: '100',
    expiry: 0,
    gracePeriodSecs: 0,
    feedId: 1,
    status: 'watching',
    createdAt: 1_000,
    updatedAt: 1_000,
    ...overrides,
  };
}

const resolved = market({ contractId: 'CUR', status: 'settled', createdAt: 1_000 });

describe('useNextRound', () => {
  let unmount: (() => void) | undefined;
  beforeEach(() => listMarketsForFeed.mockReset());
  afterEach(() => unmount?.());

  it('is disabled (never fetches) while the market is still open', async () => {
    const r = renderHook(() => useNextRound(market({ status: 'watching' })));
    unmount = r.unmount;
    await sleep(80);
    expect(listMarketsForFeed).not.toHaveBeenCalled();
    expect(r.result.current).toBeUndefined();
  });

  it('keeps polling while a resolved market has no successor', async () => {
    listMarketsForFeed.mockResolvedValue([resolved]);
    const r = renderHook(() => useNextRound(resolved));
    unmount = r.unmount;
    await waitFor(() => expect(listMarketsForFeed.mock.calls.length).toBeGreaterThanOrEqual(3));
    expect(listMarketsForFeed).toHaveBeenCalledWith(1);
    expect(r.result.current).toBeUndefined();
  });

  it('returns the successor once present and stops polling', async () => {
    const next = market({ contractId: 'NEXT', createdAt: 2_000 });
    listMarketsForFeed.mockResolvedValue([resolved, next]);
    const r = renderHook(() => useNextRound(resolved));
    unmount = r.unmount;
    await waitFor(() => expect(r.result.current?.contractId).toBe('NEXT'));
    const calls = listMarketsForFeed.mock.calls.length;
    await sleep(100);
    expect(listMarketsForFeed.mock.calls.length).toBe(calls);
  });

  it('ignores watching markets created before (or with) the resolved one', async () => {
    const older = market({ contractId: 'OLD', createdAt: 500 });
    const same = market({ contractId: 'SAME', createdAt: 1_000 });
    const settledNewer = market({ contractId: 'DONE', status: 'settled', createdAt: 3_000 });
    listMarketsForFeed.mockResolvedValue([older, same, settledNewer, resolved]);
    const r = renderHook(() => useNextRound(resolved));
    unmount = r.unmount;
    await waitFor(() => expect(listMarketsForFeed.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(r.result.current).toBeUndefined();
  });
});
