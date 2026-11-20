import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, isUnauthorized, messageFromApiError, type ApiError } from './api';
import { config } from './config';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function lastInit(): RequestInit {
  return fetchMock.mock.calls.at(-1)![1] as RequestInit;
}

const validState = {
  status: 'Open',
  poolYes: '100',
  poolNo: '200',
  totalSupply: '300',
  strikePrice: '6500000',
  finalPrice: '0',
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('request()', () => {
  it('returns parsed JSON on success and hits the oracle URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ contractId: 'C1' }]));
    await expect(api.listMarkets()).resolves.toEqual([{ contractId: 'C1' }]);
    expect(fetchMock.mock.calls[0][0]).toBe(`${config.oracleUrl}/markets`);
  });

  it('always sends credentials and a JSON content-type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ sent: true }));
    await api.requestEmailCode('a@b.c');
    const init = lastInit();
    expect(init.credentials).toBe('include');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('sends x-admin-key on admin calls', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ totalMarkets: 0 }));
    await api.getAdminOverview('secret');
    expect((lastInit().headers as Record<string, string>)['x-admin-key']).toBe('secret');
  });

  it('throws with status and JSON body on a non-OK response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Bad input' }, 400));
    const err = (await api.faucet('G1').catch((e) => e)) as ApiError;
    expect(err.status).toBe(400);
    expect(err.message).toBe('POST /markets/faucet failed: 400 {"message":"Bad input"}');
    expect(messageFromApiError(err)).toBe('Bad input');
  });

  it('throws with the raw text on a non-OK HTML response', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }));
    const err = (await api.listMarkets().catch((e) => e)) as ApiError;
    expect(err.status).toBe(502);
    expect(err.message).toBe('GET /markets failed: 502 <html>Bad Gateway</html>');
    expect(messageFromApiError(err)).toBe(err.message);
  });

  it('still throws when the error body cannot be read', async () => {
    const res = new Response(null, { status: 500 });
    vi.spyOn(res, 'text').mockRejectedValue(new Error('stream broke'));
    fetchMock.mockResolvedValue(res);
    const err = (await api.listMarkets().catch((e) => e)) as ApiError;
    expect(err.status).toBe(500);
    expect(err.message).toBe('GET /markets failed: 500 ');
  });

  it('applies a default timeout signal that aborts a hung request', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
        }),
    );
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => AbortSignal.abort(new DOMException('t', 'TimeoutError')));
    await expect(api.listMarkets()).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(timeoutSpy).toHaveBeenCalledWith(20_000);
    timeoutSpy.mockRestore();
  });
});

describe('response validation', () => {
  it('accepts a well-formed market state', async () => {
    fetchMock.mockResolvedValue(jsonResponse(validState));
    await expect(api.getMarketState('C1')).resolves.toEqual(validState);
  });

  it('names the endpoint and field for a non-numeric pool value', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...validState, poolYes: null }));
    await expect(api.getMarketState('C1')).rejects.toThrow(
      'Unexpected response from GET /markets/C1/state: field "poolYes" expected an integer string, got null',
    );
  });

  it('rejects an unknown status explicitly', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...validState, status: 'Paused' }));
    await expect(api.getMarketState('C1')).rejects.toThrow(/field "status" has unknown value "Paused"/);
  });

  it('validates positions, fee and price', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ yes: 1, no: '0' }));
    await expect(api.getPosition('C1', 'G1')).rejects.toThrow(/field "yes"/);
    fetchMock.mockResolvedValueOnce(jsonResponse({ feeBps: '30' }));
    await expect(api.getFee('C1')).rejects.toThrow(/field "feeBps"/);
    fetchMock.mockResolvedValueOnce(jsonResponse({ yesBps: 5000, noBps: 5000, yesBpsChange: null }));
    await expect(api.getPrice('C1')).resolves.toMatchObject({ yesBps: 5000 });
  });
});

describe('messageFromApiError', () => {
  it('extracts message from a JSON body in the error string', () => {
    expect(messageFromApiError(new Error('POST /x failed: 400 {"message":"Nope"}'))).toBe('Nope');
  });

  it('falls back to the full message when message is an array or missing', () => {
    const arr = new Error('POST /x failed: 400 {"message":["a","b"]}');
    expect(messageFromApiError(arr)).toBe('a; b');
    const none = new Error('POST /x failed: 400 {"error":"x"}');
    expect(messageFromApiError(none)).toBe(none.message);
  });

  it('returns the message for plain errors and invalid JSON', () => {
    expect(messageFromApiError(new Error('boom'))).toBe('boom');
    expect(messageFromApiError(new Error('bad {json'))).toBe('bad {json');
  });

  it('uses a generic message for non-Error values', () => {
    expect(messageFromApiError('oops')).toBe('Something went wrong. Please try again.');
    expect(messageFromApiError(undefined)).toBe('Something went wrong. Please try again.');
  });
});

describe('isUnauthorized', () => {
  it('is true only for 401', () => {
    expect(isUnauthorized(Object.assign(new Error(), { status: 401 }))).toBe(true);
    expect(isUnauthorized(Object.assign(new Error(), { status: 403 }))).toBe(false);
    expect(isUnauthorized(new TypeError('Failed to fetch'))).toBe(false);
    expect(isUnauthorized(null)).toBe(false);
  });
});
