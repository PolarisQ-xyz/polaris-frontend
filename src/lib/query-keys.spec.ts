import { describe, expect, it, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { invalidateAfterTrade } from './query-keys';

function keysInvalidated(args: Parameters<typeof invalidateAfterTrade>[1]) {
  const invalidateQueries = vi.fn().mockResolvedValue(undefined);
  return invalidateAfterTrade({ invalidateQueries } as unknown as QueryClient, args).then(() =>
    invalidateQueries.mock.calls.map(([{ queryKey }]) => queryKey),
  );
}

describe('invalidateAfterTrade', () => {
  it('refreshes position, balance and portfolio row after a market buy', async () => {
    expect(await keysInvalidated({ kind: 'market', id: 'C1', address: 'GUSER' })).toEqual([
      ['state', 'C1'],
      ['price', 'C1'],
      ['position', 'C1', 'GUSER'],
      ['walletBalance', 'GUSER'],
      ['portfolio-row', 'C1', 'GUSER'],
    ]);
  });

  it('refreshes the perpetual equivalents after a perpetual buy', async () => {
    expect(await keysInvalidated({ kind: 'perpetual', id: 'P1', address: 'GUSER' })).toEqual([
      ['perpetualState', 'P1'],
      ['perpetualPrice', 'P1'],
      ['perpetualPosition', 'P1', 'GUSER'],
      ['walletBalance', 'GUSER'],
      ['portfolio-perpetual-row', 'P1', 'GUSER'],
    ]);
  });
});
