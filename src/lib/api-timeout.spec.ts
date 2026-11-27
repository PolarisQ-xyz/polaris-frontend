import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_MUTATION_TIMEOUT_MS,
  MUTATION_TIMEOUT_MESSAGE,
  REQUEST_TIMEOUT_MS,
  api,
  isTimeoutError,
  mutationErrorMessage,
} from './api';

/** #101: admin mutations get a long timeout; reads keep 20s; a caller's own signal wins. */

const fetchMock = vi.fn();

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

let timeoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => jsonResponse({ contractId: 'C1' }));
  vi.stubGlobal('fetch', fetchMock);
  timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
});

afterEach(() => {
  timeoutSpy.mockRestore();
  vi.unstubAllGlobals();
});

describe('request() timeouts', () => {
  it('keeps the 20s default for read calls', async () => {
    await api.listMarkets();
    expect(timeoutSpy).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
    expect(REQUEST_TIMEOUT_MS).toBe(20_000);
  });

  it.each([
    ['createMarket', () => api.createMarket('k', {})],
    ['createPerpetual', () => api.createPerpetual('k', {})],
    ['triggerSettle', () => api.triggerSettle('k', 'C1')],
    ['triggerCancel', () => api.triggerCancel('k', 'C1')],
    ['triggerTerminate', () => api.triggerTerminate('k', 'C1')],
  ])('%s uses the long admin-mutation timeout', async (_name, call) => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        contractId: 'C1',
        status: 'Open',
        poolYes: '0',
        poolNo: '0',
        totalSupply: '0',
      }),
    );
    await call();
    expect(timeoutSpy).toHaveBeenCalledWith(ADMIN_MUTATION_TIMEOUT_MS);
    expect(timeoutSpy).not.toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
    expect(ADMIN_MUTATION_TIMEOUT_MS).toBeGreaterThanOrEqual(120_000);
  });

  it('never forwards the internal timeoutMs option to fetch', async () => {
    await api.createMarket('k', {});
    const init = fetchMock.mock.calls[0][1] as Record<string, unknown>;
    expect(init).not.toHaveProperty('timeoutMs');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('isTimeoutError / mutationErrorMessage', () => {
  it('recognises timeout and abort errors', () => {
    expect(isTimeoutError(new DOMException('t', 'TimeoutError'))).toBe(true);
    expect(isTimeoutError(new DOMException('a', 'AbortError'))).toBe(true);
    expect(isTimeoutError(new Error('POST /markets/create failed: 500 {}'))).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
  });

  it('warns against blind retry on timeout', () => {
    const message = mutationErrorMessage(new DOMException('t', 'TimeoutError'));
    expect(message).toBe(MUTATION_TIMEOUT_MESSAGE);
    expect(message).toMatch(/Markets list before retrying/);
  });

  it('uses the backend message for other failures', () => {
    expect(
      mutationErrorMessage(new Error('POST /markets/create failed: 400 {"message":"strike must be positive"}')),
    ).toBe('strike must be positive');
  });
});

describe('caller-supplied signal', () => {
  it('is passed to fetch as-is and replaces the built-in timeout', async () => {
    const controller = new AbortController();
    await api.createMarket('k', {}, controller.signal);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
    expect(timeoutSpy).not.toHaveBeenCalled();
  });

  it('aborting it rejects the request with an abort error', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    );
    const controller = new AbortController();
    const pending = api.createPerpetual('k', {}, controller.signal);
    controller.abort();
    const err = await pending.catch((e: unknown) => e);
    expect(isTimeoutError(err)).toBe(true);
  });
});
