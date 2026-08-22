# Portable Baseline Capsule steward run

Date: 2026-08-19

Status: `TEST`

Technical steward disposition: `TEST_READY_WITH_LIVE_AND_TEMP_ROUTING_LIMITS`

Human acceptance: `NOT_RUN`

## Outcome

The remaining Baseline Simulation Lab identity seam is now a bounded leaf:
`shared/portable-baseline-capsule`. It creates and verifies digest-bound
baseline capsules for software repositories, Mirror state, and specialist-mask
overlays. It also produces deterministic comparison receipts.

This is not a new simulator. It composes existing AXM organs and gives a later
simulation lab one exact baseline reference to carry through a Verified
Capability Cycle.

## What changed

- Added `axm.portable-baseline-capsule/v1` with deterministic build and rebuild
  verification.
- Added software, Mirror, and specialist-mask adapter boundaries.
- Kept software commit ancestry separate from dirty-worktree state.
- Kept Original Mirror, private lessons, and disposable challenger references
  separate without embedding private bytes.
- Bound specialist host model, mask version/package, allowed capabilities, and
  evidence ceiling while enforcing `permissionGrant: NONE` and
  `identityEffect: OVERLAY_ONLY`.
- Added generated-view freshness routing and explicit unsupported-field
  preservation through digest references.
- Added comparison states `NO_NEW_INFORMATION`, `NEW_INFORMATION`,
  `BASELINE_CHANGED`, and `INCOMPARABLE`.
- Added a narrow reference handoff compatible with the existing Verified
  Capability Loop.

## Live evidence

`CURRENT_SOFTWARE_BASELINE_CAPSULE.json` is a live, exact capsule for this new
six-file leaf. It binds:

- repository HEAD `c6e7909267f51a6fa14395e46d6917678ef87d06`;
- a declared six-file content manifest;
- the module contract digest;
- a separate scoped dirty-worktree status digest; and
- one current generated baseline view.

It deliberately does not claim to capture the whole shared Workshop. The
worktree is heavily dirty and concurrently shared, so expanding that claim
without a declared whole-workspace manifest would be false precision.

All intake source work used the already established external D-drive quarantine
and Workshop evidence. This increment wrote nothing to C-drive intake paths.

One required check exposed a separate routing defect: the already modified
`tests/tool-forge-package-test.js` uses Node's `os.tmpdir()`. On Windows that
resolved to the system temporary directory on C and the test left its proof ZIP
there. That is neither the AXM build root nor the 5YFF intake path. Because the
test file already carries another contributor's uncommitted change, this run did
not overwrite it; `READINESS.json` records the behavior as `DEGRADED`.

## Proof routes

| Claim | Evidence route | Result |
|---|---|---|
| Capsule output is deterministic and tamper-evident | focused Node selftest rebuilds each output and mutates capsule/comparison fields | `PASS` |
| Three adapter boundaries behave as declared | focused positive and refusal fixtures | `PASS` in synthetic harness |
| Software leaf identity is current | declared manifest hashes + scoped Git-status digest + capsule rebuild | `PASS` for six-file leaf |
| Verified Capability Loop accepts the reference shape | focused native loop build and verification | `PASS` |
| Existing Workshop remains coherent | ten required Workshop checks | all exit `0`; `VERIFIED_WITH_LIMITS` |
| Mirror private live state works | requires private live observation | `NOT_RUN` |
| A host model behaves within a specialist mask | requires model runtime evidence | `NOT_RUN` |
| Browser surface works | no browser surface exists | `NOT_APPLICABLE` |

## Boundaries

The module reads no disk, invokes no Git command, loads no model, and executes
no supplied source. Callers provide exact references. It grants no write,
install, permission, promotion, merge, CANON, Foundation, publication, or model
training authority.

The implementation and its tests are technical steward material. Mike Tobi
remains the human merge and CANON gate.

## Verification

- Focused module suite: `34 PASS`, `0 FAIL`.
- Audit/live-capsule suite: `28 PASS`, `0 FAIL`.
- All ten AGENTS.md required checks exited `0`.
- `verify.js`: `0 FAIL`, `17 warn`; the 17 existing warnings route to evidence,
  with `0` replayable and `0` repair-design items.
- `hub/verify-plus.js`: `VERIFIED_WITH_LIMITS`, 6 receipts, 9 atomic claims.
- HTML script syntax: `55 PASS`, `0 FAIL`.
- Agent Tool Forge: `17 PASS`, `0 FAIL`.
- Evidence Desk: `36 PASS`, `0 FAIL`.
- Browser render/click: `NOT_APPLICABLE` for this pure contract leaf; no browser
  claim is made.

See `VERIFICATION_RECEIPT.json` for the command-level result record.

## Remaining grounded next step

Use this capsule as the identity input on a later isolated Baseline Simulation
Lab branch. Begin with one authorized software baseline. Add Mirror or a
specialist host only when exact observations are available. If the capsule and
new-information references are unchanged, the run should stop with
`NO_NEW_INFORMATION` rather than manufacture activity.
