import { describe, expect, it } from 'vitest';
import spec from './__fixtures__/contract-spec.json';
import { AUTH_ADDRESS_PARAM, I128_FIELDS, PREDICTION_FIELD } from './trade-args';

type Arg = { name: string; type: string };

/**
 * Drift guard: every field `trade-args.ts` maps must exist on the contract
 * function with the type the wallet code converts it to. A renamed or
 * retyped parameter in `__fixtures__/contract-spec.json` fails here instead
 * of at trade-time simulation.
 */
describe.each(['market', 'perpetual'] as const)('%s contract interface', (kind) => {
  const fns = spec[kind] as Record<string, Arg[]>;
  const typeOf = (fn: string, name: string) => fns[fn]?.find((a) => a.name === name)?.type;

  it.each(Object.keys(I128_FIELDS))('%s: mapped i128 fields are i128 args, and no i128 arg is unmapped', (fn) => {
    expect(fns[fn], `${fn} missing from spec`).toBeDefined();
    for (const field of I128_FIELDS[fn]) expect(typeOf(fn, field), `${fn}.${field}`).toBe('i128');
    const specI128 = fns[fn].filter((a) => a.type === 'i128').map((a) => a.name);
    expect([...I128_FIELDS[fn]].sort()).toEqual(specI128.sort());
  });

  it.each(Object.keys(I128_FIELDS))('%s: prediction field matches the Prediction arg', (fn) => {
    const specPrediction = fns[fn].find((a) => a.type === 'Prediction')?.name;
    expect(PREDICTION_FIELD[fn]).toBe(specPrediction);
  });

  it.each(Object.keys(AUTH_ADDRESS_PARAM))('%s: auth address param is an address arg', (fn) => {
    expect(typeOf(fn, AUTH_ADDRESS_PARAM[fn]), `${fn}.${AUTH_ADDRESS_PARAM[fn]}`).toBe('address');
  });
});
