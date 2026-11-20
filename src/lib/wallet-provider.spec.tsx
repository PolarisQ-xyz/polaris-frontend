// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { cleanup, flush, render } from '@/test/render';

vi.mock('./freighter-wallet', () => ({
  connectFreighter: vi.fn(),
  getConnectedAddress: vi.fn(),
  isFreighterAvailable: vi.fn(),
}));
vi.mock('./api', () => ({
  api: {
    getEmailSession: vi.fn(),
    requestEmailCode: vi.fn(),
    verifyEmailCode: vi.fn(),
    emailLogout: vi.fn(),
  },
  messageFromApiError: (err: unknown) => (err as Error).message,
}));

import { connectFreighter, getConnectedAddress, isFreighterAvailable } from './freighter-wallet';
import { api } from './api';
import { WalletProvider, useWallet } from './wallet-provider';

let ctx: ReturnType<typeof useWallet>;
function Probe() {
  ctx = useWallet();
  return null;
}
const mount = () => render(<WalletProvider><Probe /></WalletProvider>);

beforeEach(() => {
  vi.mocked(isFreighterAvailable).mockResolvedValue(true);
  vi.mocked(getConnectedAddress).mockResolvedValue(null as never);
  vi.mocked(api.getEmailSession).mockRejectedValue(new Error('no session'));
  vi.mocked(api.emailLogout).mockResolvedValue(undefined as never);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('WalletProvider restore precedence', () => {
  it('restores an authorized Freighter wallet and never consults the email session', async () => {
    vi.mocked(getConnectedAddress).mockResolvedValue('GFREIGHTER' as never);
    vi.mocked(api.getEmailSession).mockResolvedValue({ address: 'GEMAIL' } as never);
    await mount();
    await flush();
    expect(ctx.wallet).toEqual({ kind: 'freighter', address: 'GFREIGHTER' });
    expect(api.getEmailSession).not.toHaveBeenCalled();
  });

  it('falls back to the email session when Freighter is not authorized', async () => {
    vi.mocked(api.getEmailSession).mockResolvedValue({ address: 'GEMAIL' } as never);
    await mount();
    await flush();
    expect(ctx.wallet).toEqual({ kind: 'email', address: 'GEMAIL' });
  });

  it('stays signed out when neither exists', async () => {
    await mount();
    await flush();
    expect(ctx.wallet).toBeNull();
    expect(ctx.freighterAvailable).toBe(true);
  });
});

describe('WalletProvider actions', () => {
  it('connectWallet error sets `error` and returns null', async () => {
    vi.mocked(connectFreighter).mockRejectedValue(new Error('User declined'));
    await mount();
    await flush();
    let result: unknown;
    await act(async () => {
      result = await ctx.connectWallet();
    });
    expect(result).toBeNull();
    expect(ctx.error).toBe('User declined');
    expect(ctx.connecting).toBe(false);
    expect(ctx.wallet).toBeNull();
  });

  it('verifyEmailCode success sets the email wallet and resets the step', async () => {
    vi.mocked(api.requestEmailCode).mockResolvedValue(undefined as never);
    vi.mocked(api.verifyEmailCode).mockResolvedValue({ address: 'GEMAIL' } as never);
    await mount();
    await flush();
    await act(async () => {
      await ctx.requestEmailCode('a@b.co');
    });
    expect(ctx.emailStep).toBe('code-sent');
    await act(async () => {
      await ctx.verifyEmailCode('a@b.co', '123456');
    });
    expect(api.verifyEmailCode).toHaveBeenCalledWith('a@b.co', '123456');
    expect(ctx.wallet).toEqual({ kind: 'email', address: 'GEMAIL' });
    expect(ctx.emailStep).toBe('idle');
    expect(ctx.error).toBeNull();
  });

  it('logout clears wallet, step and error and ends the email session', async () => {
    vi.mocked(getConnectedAddress).mockResolvedValue('GFREIGHTER' as never);
    vi.mocked(api.requestEmailCode).mockRejectedValue(new Error('rate limited'));
    await mount();
    await flush();
    await act(async () => {
      await ctx.requestEmailCode('a@b.co');
    });
    expect(ctx.error).toBe('rate limited');
    await act(async () => ctx.logout());
    expect(api.emailLogout).toHaveBeenCalled();
    expect(ctx.wallet).toBeNull();
    expect(ctx.emailStep).toBe('idle');
    expect(ctx.error).toBeNull();
  });
});
