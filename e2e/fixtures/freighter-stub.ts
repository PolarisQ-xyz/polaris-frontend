import type { Page } from '@playwright/test';
import { TEST_ADDRESS } from './data';

export const TESTNET = 'Test SDF Network ; September 2015';
export const PUBNET = 'Public Global Stellar Network ; September 2015';

export type FreighterStubOptions = {
  /** `false` = extension not installed. */
  installed?: boolean;
  /** Already authorized for this origin (silent restore on mount). */
  connected?: boolean;
  address?: string;
  networkPassphrase?: string;
  connect?: 'approve' | 'reject' | 'hang';
  sign?: 'approve' | 'reject' | 'hang';
};

/**
 * Fakes the Freighter extension in the page by answering
 * `@stellar/freighter-api`'s `window.postMessage` protocol
 * (`FREIGHTER_EXTERNAL_MSG_REQUEST` → `FREIGHTER_EXTERNAL_MSG_RESPONSE`).
 * Injected only via Playwright's `addInitScript`, so it can never reach a
 * production bundle. Mutate `window.__freighterStub` mid-test (see
 * `setFreighter`) to simulate an account or network switch.
 */
export async function installFreighter(page: Page, options: FreighterStubOptions = {}) {
  const opts: Required<FreighterStubOptions> = {
    installed: true,
    connected: false,
    address: TEST_ADDRESS,
    networkPassphrase: TESTNET,
    connect: 'approve',
    sign: 'approve',
    ...options,
  };
  await page.addInitScript((initial) => {
    const w = window as unknown as { __freighterStub: typeof initial; freighter?: boolean };
    w.__freighterStub = initial;
    if (!initial.installed) return;
    w.freighter = true;

    window.addEventListener('message', (event) => {
      const req = event.data;
      if (event.source !== window || req?.source !== 'FREIGHTER_EXTERNAL_MSG_REQUEST') return;
      const s = w.__freighterStub;
      const reply = (body: Record<string, unknown>) =>
        window.postMessage({ source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE', messagedId: req.messageId, ...body }, window.location.origin);
      const rejected = { apiError: { code: -4, message: 'The user rejected this request.' } };

      switch (req.type) {
        case 'REQUEST_CONNECTION_STATUS':
          return reply({ isConnected: true });
        case 'REQUEST_ALLOWED_STATUS':
          return reply({ isAllowed: s.connected });
        case 'REQUEST_PUBLIC_KEY':
          return reply({ publicKey: s.connected ? s.address : '' });
        case 'REQUEST_ACCESS':
          if (s.connect === 'hang') return;
          if (s.connect === 'reject') return reply({ publicKey: '', ...rejected });
          s.connected = true;
          return reply({ publicKey: s.address });
        case 'REQUEST_NETWORK_DETAILS':
          return reply({
            networkDetails: {
              network: s.networkPassphrase.startsWith('Test') ? 'TESTNET' : 'PUBLIC',
              networkName: s.networkPassphrase.startsWith('Test') ? 'Test Net' : 'Main Net',
              networkUrl: '',
              networkPassphrase: s.networkPassphrase,
            },
          });
        case 'REQUEST_NETWORK':
          return reply({ network: s.networkPassphrase.startsWith('Test') ? 'TESTNET' : 'PUBLIC' });
        case 'SUBMIT_TRANSACTION':
          if (s.sign === 'hang') return;
          if (s.sign === 'reject') return reply({ signedTransaction: '', signerAddress: '', ...rejected });
          return reply({ signedTransaction: req.transactionXdr, signerAddress: s.address });
        default:
          return reply({ apiError: { code: -1, message: `freighter-stub: unhandled ${req.type}` } });
      }
    });
  }, opts);
}

/** Change stub behavior mid-test, e.g. `{ address: OTHER }` for an account switch. */
export async function setFreighter(page: Page, patch: FreighterStubOptions) {
  await page.evaluate((p) => Object.assign((window as unknown as { __freighterStub: object }).__freighterStub, p), patch);
}

/** Sends one raw request through the same protocol `@stellar/freighter-api` uses; resolves `'timeout'` if the stub never answers within `ms`. */
export function freighterRequest(page: Page, body: Record<string, unknown>, ms = 1_000) {
  return page.evaluate(
    ({ body, ms }) =>
      new Promise<unknown>((resolve) => {
        const messageId = Date.now() + Math.random();
        const timer = setTimeout(() => resolve('timeout'), ms);
        window.addEventListener('message', function onMsg(e) {
          if (e.data?.source === 'FREIGHTER_EXTERNAL_MSG_RESPONSE' && e.data.messagedId === messageId) {
            clearTimeout(timer);
            window.removeEventListener('message', onMsg);
            resolve(e.data);
          }
        });
        window.postMessage({ source: 'FREIGHTER_EXTERNAL_MSG_REQUEST', messageId, ...body }, window.location.origin);
      }),
    { body, ms },
  );
}
