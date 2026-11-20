# Contributing to polaris-frontend

This project follows an open contributor model: anyone is welcome to
contribute via peer review, testing, and patches. This document explains
the practical process, adapted from
[Bitcoin Core's CONTRIBUTING.md](https://github.com/bitcoin/bitcoin/blob/master/CONTRIBUTING.md)
— a small Next.js app doesn't need everything a project the size of
Bitcoin Core does (no mailing list, no BIP process, no release branches to
backport into), but the underlying discipline — patches are small and
focused, reviewers actually test what they review, wallet-signing code
gets a higher bar — applies here just as much as it does there.

There is no privileged "polaris-frontend developers" class. In practice
there's currently one maintainer reviewing and merging; that will change
as the project grows, and this document describes the process either way.

## Getting started

New contributors are welcome. **In-depth reviewing and testing is the
most effective way to start** — it teaches you the codebase faster than
writing a PR blind, and it's usually the bottleneck on a small project
like this one. See [Peer review](#peer-review) below.

Every open issue in this repo is written as a real gap found by using the
app, not a hypothetical — see e.g. the two open Sell-action issues, both
of which point at the exact contract capability (`sell`) that's fully
implemented on-chain but not exposed anywhere in this UI yet.

Before contributing, install and run the app and its tests (see the
README's ["Running locally"](./README.md#running-locally) and
["Testing"](./README.md#testing) sections):

```sh
npm install
npm run dev        # http://localhost:3000
npm test           # vitest
npm run lint
```

## Communication

Discussion happens in GitHub issues and pull requests. There's no
separate chat/mailing list for a project this size — if you want early
feedback on an approach before writing code, open a draft PR or comment
on the issue.

## Contributor workflow

1. Fork the repository (first time only).
2. Create a topic branch.
3. Commit patches.
4. Push to your fork and open a pull request.

### Committing patches

Commits should be atomic and diffs easy to read — don't mix formatting
fixes with actual logic changes. Each commit should build, lint clean,
and pass `npm test` on its own, not just at the tip of the branch.

Commit messages should explain _why_, not just _what_. Reference the
issue a commit addresses (`fixes #3`, `refs #3`).

### Creating the pull request

Prefix the PR title with the area it touches:

- `ui` — trade cards, market/perpetual pages, general components
- `admin` — the admin dashboard (`app/admin/*`)
- `embed` — the embeddable market widget
- `wallet` — passkey/WebAuthn code (`lib/webauthn.ts`, `lib/passkey-wallet.ts`)
- `docs` — README/comment-only changes, or the public `/docs` page
- `test` — test-only changes
- `ci` — workflow changes

Example: `ui: add a Sell action to the classic market trade card`

The PR description should explain what the patch does and, more
importantly, _why_ — what problem it fixes, and how you tested it (which
new/existing tests cover it, or what you clicked through manually against
a live/local backend). If there's reasonable doubt that you understand
your own change or tested it at a basic level, expect the PR to be closed
rather than reviewed at length.

## Pull request philosophy

Keep patches focused: one PR fixes one bug, adds one feature, or does one
refactor — not a mixture. Large, sprawling PRs are harder to review and
more likely to sit unreviewed.

**A higher bar applies to wallet/signing code and the math that mirrors
on-chain logic** — `lib/webauthn.ts`, `lib/passkey-wallet.ts`, `lib/amm.ts`,
and `lib/portfolio.ts`. This repo has already been bitten by exactly this
class of bug once (`lib/portfolio.ts`'s redemption-math mirror drifted out
of sync with a real contract fix — see the README's ["Testing"](./README.md#testing)
section) — any PR touching this surface should include a test that would
have caught the specific thing it fixes, not just pass the existing suite.

## Peer review

Anyone may review a pull request via comments. A review typically covers
whether the change is a good idea at all (concept), whether the approach
is right, and whether the code itself is correct.

- **`Concept (N)ACK`** — "I do (not) agree with the goal of this PR."
- **`Approach (N)ACK`** — "I agree with the goal, but (not) with how this
  achieves it."
- **`ACK <commit>`** — code review, plus a note on how you reviewed it:
  "I clicked through the flow against a local backend" or "I read it and
  it looks correct, didn't run it."

A `NACK` needs a reason — an unexplained NACK can be disregarded. "Nit"
means a trivial, non-blocking issue (a typo, a naming preference) — don't
block a merge over one.

If you say you tested something, say how — "ran `npm test`" is different
from "bought and sold a real position against testnet," and readers of
the PR benefit from knowing which one happened.

## Decision making

Whether a PR merges is the maintainer's call, informed by peer review.
In general, a PR should:

- Fix a real, demonstrated problem or serve a clear purpose.
- Include tests for any pure-logic change (AMM math, redemption math,
  signature handling) — UI-only changes are reasonably verified by
  clicking through the flow, described in the PR.
- Not break `npm test` or `npm run lint`.
- Update the README if it changes documented behavior (a new route, a
  new env var).

## Copyright

By contributing, you agree to license your work under the [MIT
license](./LICENSE), the same license this repository is distributed
under.
