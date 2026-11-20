// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { cleanup, flush, render } from '@/test/render';

vi.mock('./api', () => ({
  api: { getAdminOverview: vi.fn() },
  isUnauthorized: (err: unknown) => (err as { status?: number })?.status === 401,
}));

import { api } from './api';
import { AdminKeyProvider, useAdminKey } from './admin-key-provider';

let ctx: ReturnType<typeof useAdminKey>;
function Probe() {
  ctx = useAdminKey();
  return null;
}
const mount = () => render(<AdminKeyProvider><Probe /></AdminKeyProvider>);

function deferred() {
  let resolve!: (v?: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function setKey(key: string) {
  await act(async () => ctx.setAdminKey(key));
}

beforeEach(() => window.sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AdminKeyProvider probe state machine', () => {
  it('restores a stored key on mount and probes it', async () => {
    window.sessionStorage.setItem('polaris.adminKey', 'stored-key');
    vi.mocked(api.getAdminOverview).mockResolvedValue({} as never);
    await mount();
    await flush();
    expect(ctx.adminKey).toBe('stored-key');
    expect(api.getAdminOverview).toHaveBeenCalledWith('stored-key');
    expect(ctx.status).toBe('valid');
  });

  it('starts unset with no network call when no key exists', async () => {
    await mount();
    expect(ctx.status).toBe('unset');
    expect(api.getAdminOverview).not.toHaveBeenCalled();
  });

  it('200 → checking → valid', async () => {
    const d = deferred();
    vi.mocked(api.getAdminOverview).mockReturnValue(d.promise as never);
    await mount();
    await setKey('k');
    expect(ctx.status).toBe('checking');
    await act(async () => d.resolve({}));
    expect(ctx.status).toBe('valid');
  });

  it('401 → invalid', async () => {
    vi.mocked(api.getAdminOverview).mockRejectedValue({ status: 401 });
    await mount();
    await setKey('bad');
    await flush();
    expect(ctx.status).toBe('invalid');
  });

  it.each([
    ['500', { status: 500 }],
    ['network error', new TypeError('Failed to fetch')],
  ])('%s still counts as valid (a backend blip must not lock admins out)', async (_label, err) => {
    vi.mocked(api.getAdminOverview).mockRejectedValue(err);
    await mount();
    await setKey('k');
    await flush();
    expect(ctx.status).toBe('valid');
  });

  it('ignores a stale probe result when the key changes mid-probe', async () => {
    const first = deferred();
    const second = deferred();
    vi.mocked(api.getAdminOverview).mockReturnValueOnce(first.promise as never).mockReturnValueOnce(second.promise as never);
    await mount();
    await setKey('old');
    await setKey('new');
    expect(ctx.status).toBe('checking');
    await act(async () => first.reject({ status: 401 }));
    expect(ctx.status).toBe('checking');
    await act(async () => second.resolve({}));
    expect(ctx.status).toBe('valid');
  });

  it('clearing the key returns to unset', async () => {
    vi.mocked(api.getAdminOverview).mockResolvedValue({} as never);
    await mount();
    await setKey('k');
    await flush();
    expect(ctx.status).toBe('valid');
    await setKey('');
    expect(ctx.status).toBe('unset');
  });
});
