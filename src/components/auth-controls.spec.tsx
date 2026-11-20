// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { byText, cleanup, click, render, type } from '@/test/render';

vi.mock('@/lib/wallet-provider', () => ({ useWallet: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { getBalance: vi.fn().mockResolvedValue({ balanceStroops: '0' }) } }));

import { useWallet } from '@/lib/wallet-provider';
import { AuthControls } from './auth-controls';

type Ctx = ReturnType<typeof useWallet>;
let ctx: Ctx;

function setWallet(overrides: Partial<Ctx> = {}) {
  ctx = {
    wallet: null,
    connecting: false,
    error: null,
    freighterAvailable: true,
    connectWallet: vi.fn(),
    emailStep: 'idle',
    emailBusy: false,
    requestEmailCode: vi.fn(),
    verifyEmailCode: vi.fn(),
    resetEmailFlow: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };
  vi.mocked(useWallet).mockImplementation(() => ctx);
}

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthControls compact />
    </QueryClientProvider>,
  );

beforeEach(() => {
  setWallet();
  window.history.replaceState(null, '', '/');
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AuthControls phases', () => {
  it('signed-out: shows Connect Wallet and an email link; connect calls connectWallet', async () => {
    const { container } = await mount();
    await click(byText(container, 'Connect Wallet'));
    expect(ctx.connectWallet).toHaveBeenCalled();
    expect(byText(container, 'or use email')).not.toBeNull();
  });

  it('signed-in: shows the short address and Sign out calls logout', async () => {
    setWallet({ wallet: { kind: 'freighter', address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567' } });
    const { container } = await mount();
    expect(byText(container, 'Connect Wallet')).toBeNull();
    await click(byText(container, 'Sign out'));
    expect(ctx.logout).toHaveBeenCalled();
  });

  it('connecting: shows a disabled confirm button', async () => {
    setWallet({ connecting: true });
    const { container } = await mount();
    const btn = byText(container, 'Confirm in Freighter…') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('email-idle: "or use email" switches to the email form and submits the address', async () => {
    const { container } = await mount();
    await click(byText(container, 'or use email'));
    const input = container.querySelector('input[type="email"]');
    expect(input).not.toBeNull();
    const send = byText(container, 'Send code') as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    await type(input, 'a@b.co');
    expect(send.disabled).toBe(false);
    await click(send);
    expect(ctx.requestEmailCode).toHaveBeenCalledWith('a@b.co');
    await click(byText(container, 'Use a wallet instead'));
    expect(byText(container, 'Connect Wallet')).not.toBeNull();
  });

  it('email-code-sent: strips non-digits, caps at 6, and enables Verify only at 6 digits', async () => {
    setWallet({ freighterAvailable: false, emailStep: 'code-sent' });
    const { container } = await mount();
    const input = container.querySelector('input[placeholder="6-digit code"]') as HTMLInputElement;
    const verify = byText(container, 'Verify') as HTMLButtonElement;
    expect(input.maxLength).toBe(6);
    await type(input, '12a3-4');
    expect(input.value).toBe('1234');
    expect(verify.disabled).toBe(true);
    await type(input, '123456');
    expect(verify.disabled).toBe(false);
    await click(verify);
    expect(ctx.verifyEmailCode).toHaveBeenCalledWith('', '123456');
    await click(byText(container, 'Use a different email'));
    expect(ctx.resetEmailFlow).toHaveBeenCalled();
  });

  it('Freighter unavailable: auto-switches to email and shows the install link', async () => {
    setWallet({ freighterAvailable: false });
    const { container } = await mount();
    expect(container.querySelector('input[type="email"]')).not.toBeNull();
    const link = container.querySelector('a[href="https://freighter.app"]');
    expect(link).not.toBeNull();
    expect(byText(container, 'Use a wallet instead')).toBeNull();
  });

  it('?new=1 is consumed: highlights connect and is removed from the URL, keeping other params', async () => {
    window.history.replaceState(null, '', '/markets?new=1&ref=x');
    const { container } = await mount();
    expect(window.location.search).toBe('?ref=x');
    expect(byText(container, /Connects Freighter/)).not.toBeNull();
    expect(byText(container, 'Connect Wallet')?.className).toMatch(/animate-pulse/);
  });
});
