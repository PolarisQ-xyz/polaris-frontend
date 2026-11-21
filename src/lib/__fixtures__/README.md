# Contract fixtures

Checked-in snapshots of `polaris-contracts` behavior, so frontend mirrors fail
loudly when the contract drifts. Each file records the contract commit it was
taken from in `_provenance.commit`; bump it whenever you regenerate.

## `amm-vectors.json` (used by `amm.spec.ts`)

`(prediction, poolYes, poolNo, feeBps, amount) → sharesOut` for `buy`'s swap
leg: `cpmm_out(reserve_in, reserve_out, apply_fee(amount, fee_bps))` from
`contracts/ctf-math/src/lib.rs`, with `reserve_in` = the unwanted side's pool.

To regenerate, add a throwaway test to `contracts/ctf-math` in polaris-contracts
that loops over the same input grid (pools × fees × amounts × side, see the
existing file) and prints each vector as JSON, then run
`cargo test -p ctf-math -- --nocapture` and paste the output into `vectors`.
Keep extremes in the grid: 1-unit pools, `feeBps` 0 and 10000, and pools near
i128-safe magnitudes.

## `contract-spec.json` (used by `trade-args.spec.ts`)

Argument names/types of every function `trade-args.ts` maps, for the market and
perpetual contracts. To regenerate, build the wasm in polaris-contracts
(`stellar contract build`) and run, for each contract:

```sh
stellar contract info interface --wasm target/wasm32v1-none/release/polaris_market.wasm --output json-formatted
```

then copy each mapped function's `inputs` as `{ name, type }` pairs (`i128`,
`address`, or the UDT name `Prediction`).
