// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminOverviewPage from './page';
import AdminWalletsPage from './wallets/page';
import AdminMarketsPage from './markets/page';
import { byText, cleanup, click, render } from '@/test/render';

const m = vi.hoisted(() => ({ query: {} as Record<string, unknown> }));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => m.query,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/lib/admin-key-provider', () => ({ useAdminKey: () => ({ adminKey: 'k' }) }));
vi.mock('@/lib/api', () => ({ api: {}, messageFromApiError: (e: Error) => e.message }));

afterEach(cleanup);

describe.each([
  ['overview', AdminOverviewPage],
  ['wallets', AdminWalletsPage],
])('admin %s', (_name, Page) => {
  it('shows a failed fetch with a working retry', async () => {
    const refetch = vi.fn();
    m.query = { data: undefined, error: new Error('boom'), isLoading: false, refetch };
    const { container } = await render(<Page />);
    expect(container.textContent).toContain('boom');
    expect(container.textContent).not.toContain('Loading…');
    await click(byText(container, 'Retry'));
    expect(refetch).toHaveBeenCalledOnce();
  });
});

describe('admin markets actions', () => {
  it.each([
    ['watching', false, false],
    ['pending', false, false],
    ['settling', true, false],
    ['cancelling', true, false],
    ['settled', true, true],
    ['cancelled', true, true],
  ])('%s: settle disabled=%s, cancel disabled=%s', async (status, settle, cancel) => {
    m.query = {
      data: [{ contractId: 'C1', status, strikePriceCents: '15' }],
      error: null,
      isLoading: false,
    };
    const { container } = await render(<AdminMarketsPage />);
    await click(byText(container, /^All/));
    expect((byText(container, 'Settle') as HTMLButtonElement).disabled).toBe(settle);
    expect((byText(container, 'Cancel') as HTMLButtonElement).disabled).toBe(cancel);
  });
});
