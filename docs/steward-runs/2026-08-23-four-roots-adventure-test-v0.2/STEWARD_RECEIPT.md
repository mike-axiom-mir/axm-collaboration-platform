# Four Roots Adventure TEST v0.2 steward receipt

Status: `TEST`

Run opened and sealed 2026-08-23 Europe/Amsterdam. This is append-only
evidence for a review branch. It is not a public release, canonical-checkout
integration, promotion beyond TEST, or `CANON` receipt.

## Lineage

- Worktree: clean dedicated `AXM_ACTIVE` lane; machine-local path not retained.
- Branch: `codex/four-roots-adventure-test-v0.2`.
- Selected, proven Fabric v2.5 base: `41cfa3401cc45bfb890e7fa4ad55b41d24c6c16b`.
- Fabric v2.5 technical prerequisite: `458f79bb346116d707513bf24755b0b2db663f35`.
- Fabric v2.4 prerequisite merge: `f43300a2e3663600dee9c4fee821e087c404d323`.
- Bounded Four Roots Adventure technical commit: `c813e283a6db8306044b50f0fc8a90fe6fff6fa1`.
- Canonical target observed immediately before seal: branch
  `codex/workshop-recovery-fabric-integration-20260822`, commit
  `dadd8a9f87c2cf70a7c444244483ee853276e745`, clean checkout.
- The canonical target advanced three commits from the initially observed
  `3d6daa4ff6af7f0d48a345e5d30e038c40c8fa47` during this run.
- The selected Fabric base is not an ancestor of that target. Their merge base
  is `03e1899f92ad52bdca6b988ad5ce13e75adbaf2b`; they have 6 and 7 unique
  commits respectively. One changed path intersects this run:
  `shared/code-capability-fabric/README.md`.

The exact 41 changed paths are listed in `CHANGED_PATHS.txt`.

## What changed

1. Promoted the exact first generated Four Roots Run lineage into an internal
   Workshop `TEST` package under the explicit in-thread Mike direction. The
   record binds the v0.1 request, packet, bundle, live iteration, and source
   commit. It records `authenticatedIdentityProven: false` rather than
   inventing cryptographic identity proof.
2. Added a pure provider-neutral adventure-content generator. It validates one
   versioned recipe and emits a deterministic one-file content packet plus a
   non-writing install plan. It loads no provider, executes no generated code,
   writes nothing, uses no network, and cannot install, integrate, publish,
   modify Foundation, promote itself, or change `CANON`.
3. Added closed schemas and adversarial tests for exact promotion scope,
   immutable ancestry, four-root ordering, resource ceilings, public-rights
   hold, authority drift, digest drift, malformed maps/references, Windows
   aliases, and content tampering.
4. Installed a reviewed native Game Hub shell in new slot 020. The game has
   five connected zones, four keepers, 25 actor interactions, ten discoveries,
   six quests, ordered roots, and the authored `A Door Into Review` ending.
5. Added server-owned revision-checked state, atomic file persistence outside
   the repository, content-digest save binding, strict HTTP input and size
   limits, raw UNC/traversal rejection, deliberate reset, and honest fresh-state
   recovery for corrupt or incompatible saves.
6. Added accessible visible controls plus WASD/arrows, E/Space, Escape, contrast,
   and calm-motion controls. No phone, touch, or gamepad capability is
   advertised.
7. Preserved the exact v0.1 candidate as a tracked immutable rollback locator.
   A broad repository rollback-ignore rule initially hid this record; the
   steward gate caught it before sealing, and the exact data file was
   deliberately included so a fresh checkout retains the same lineage.
8. Compared required capabilities before and after. The scoped small-adventure
   vertical moved from `BLOCKED` to `READY`, with no missing required capability
   or proposed hand. The result does not claim a universal game engine.

## Exact release evidence

- v0.1 request: `sha256:d3b129dff29b3c045633513057d88d0fd8155d28711f8cfee4fab1370ac9c86d`.
- v0.1 packet: `sha256:0f92db03251710f34c8b50ea13d30e2a910336d3d0d6ceb884824d68951416c7`.
- v0.1 module bundle: `sha256:934c6600a6f5e919f0189e6efc0d60c0f35b0e46bbc1096f3c33c9054afe8358`.
- v0.1 live iteration:
  `sha256:9ad3bfe37db7c90e6d98ff24636d1a1b39c04b58ab4714401b1b521de286a408`.
- TEST promotion decision:
  `sha256:4621feeff293f7791f760f807cb337f0276ab4564c0f1024de0817869f40e888`.
- v0.2 growth request:
  `sha256:71c695b2478b7bb891b4c208c0a918c21376cee9758018644e9f695dfb2659a3`.
- v0.2 content packet:
  `sha256:a6282704d1c78b0f8fbb7c03e5d6588b872a01a41a25c5abc097bfb7ac76f039`.
- Installed content: 25,693 bytes,
  `sha256:fa5e159f6d7266bd4f3881983e567ae2cce21ca339ac26e7921912439f02dd8d`.

## Verification

All required `AGENTS.md` commands passed on the technical tree:

- `node verify.js` — `0 FAIL · 22 warn · spine b618c5762240070c`.
- `node hub/hub-selftest.js` — passed.
- `node hub/route-selftest.js` — passed.
- `node hub/graft-selftest.js` — passed.
- `node hub/skin-selftest.js` — passed.
- `node hub/verify-plus.js` — passed; Verification Spine v2 remained
  `VERIFIED_WITH_LIMITS` with the same 22 warnings.
- `node tests/html-script-syntax-test.js` — `55 PASS · 0 FAIL`.
- `node tests/tool-forge-package-test.js` — passed; transient proof cleaned;
  installed false.
- `node tools/agent-tool-forge/selftest.js` — `17 PASS · 0 FAIL`.
- `node tools/evidence-desk/selftest.js` — `36 PASS · 0 FAIL`.

Focused continuity also passed:

- All 14 `shared/code-capability-fabric/selftest*.js` suites, including v2
  routing (74), v1 routing (18), semantic candidate generation (104), the
  immutable v0.1 game generator (12), and the new v0.2 content generator (13).
- Existing Sandbox Session-1 suite: `27 PASS · 0 FAIL`.
- Disposable candidate Sandbox suite: all `11 cases`.
- Game package verifier selftest: `21 assertions`; Game Runtime Port, Game
  Night, and Universal Control policy selftests passed.
- Four Roots Adventure package: `47 assertions`.
- Four Roots Adventure HTTP boundary: `43 assertions`.
- Automated complete journey: `202 moves · 25 interactions · 6 quests`.
- Automated restart persistence: `20 assertions`.
- Full Game Hub library verifier: `0 failures · 17 warnings · 20 game
  folders`; slot 020 passed without a warning. The 17 warnings are physical
  phone QA gaps in other packages.
- Capability comparator after the work: every required row `READY`, no missing
  capability, no proposed hand.

Live browser evidence was separate from script verification:

- Default desktop render and initial state were observed.
- Visible interaction and movement controls plus ArrowLeft and Escape were
  exercised.
- A complete visible-control journey reached all four roots, ten discoveries,
  six quests, and the ending in 192 moves.
- Browser reload preserved that exact state.
- The server process was stopped and restarted; a fresh process restored the
  exact content-bound completed save and ending.
- A real 643 by 804 narrow Chrome window was inspected through header, map,
  controls, journal, progress, inventory, and ending with no horizontal
  clipping observed.
- Raw frames were not durably retained. Detailed bounded observations are in
  `visual-play-evidence.json` and routed in `CLAIM_EVIDENCE_MATRIX.md`.

The original intake named 41 warnings. The selected v2.5 base and this run both
report 22. This run did not hide or repair those 22 inherited warnings.

## Unrun, unsupported, or still uncertain

- Human taste, pacing, prose, and replay-value review remains open even though
  the complete technical journey passes.
- No physical phone, touchscreen, gamepad, screen reader, external
  assistive-technology device, audio, combat, multiplayer, 3D, procedural
  content, or AI challenger was tested or claimed.
- Browser renderer CPU, memory, wall-time, and frame pacing were not
  independently measured. Server input/output limits are tested; this native
  game runtime is not evidence that arbitrary uploaded code is safe.
- Save migration across content releases is intentionally absent. Digest drift
  starts fresh with an honest notice rather than silently coercing state.
- Public direct-reuse rights remain `HOLD`; internal TEST direction does not
  decide public copying rights.
- Authenticated human identity, nonce/replay ledger, expiry, and revocation
  remain future tier-control work.
- The canonical target was not merged, overwritten, promoted, published, or
  canonized.

## Decisions preserved

- The four technical roots gate acceptance first. A root `HOLD` or `FAIL`
  cannot be clicked into `PASS`; the proposal or evidence must change.
- Mike may always hold or reject and remains the final merge gate.
- The narrative Mike Workshop Gate is a story location, not technical
  authority.
- The generator may grow immutable candidates and content packets, but cannot
  install or approve them. This branch installation is a separate host-steward
  action under recorded Mike direction.
- Internal Workshop status is exactly `TEST`. Passing tests do not mean CANON.
- Public reuse remains held; no model training, hidden learning admission,
  physical actuation, publication, or public installation is authorized.

## Evidence curation

- Session id: `2026-08-23-four-roots-adventure-test-v0.2`.
- Sealed segment: `session.jsonl` — 9 ordered events, 9 valid JSON lines,
  2,986 bytes.
- Seal digest:
  `sha256:720b6b45b3468e37ecf409da1e4398a116e4cb7345c73a13db62d2d11c885bf8`.
- Durable events preserved: scoped Mike decision, two technical changes, the
  rollback-ignore failure, its repair, automated verification, live visual
  observation, canonical-target drift, and final handoff boundary.
- Telemetry aggregation: repeated healthy test output and browser polling were
  reduced to exact suite totals, state transitions, and exceptions.
- Temporary material deleted: none; raw screenshots and recordings were never
  written to a temporary or repository path.
- Explicit retention exceptions: the exact product, tests, schemas, promotion
  decision, installation receipt, and rollback locator are product/evidence
  state and are retained. No private source or user upload was absorbed.
- Derived views updated: capability before/after comparison, claim/evidence
  matrix, visual evidence summary, changed-path index, and this receipt.
- Unclassified items: none.
- Authority used: bounded branch stewardship and recorded internal TEST
  direction only; no integration, publication, promotion beyond TEST, or CANON.

## Safe integration route

Do not cherry-pick the Four Roots technical commit alone: it depends on the
Fabric v2.4/v2.5 lineage that the observed canonical target does not yet
contain. Do not use a busy canonical checkout.

After re-checking the target branch, HEAD, and dirty state, create a new clean
review worktree at the Mike-selected target. From that clean review worktree,
stage the complete branch integration without committing it:

```powershell
git merge --no-ff --no-commit codex/four-roots-adventure-test-v0.2
```

Review the full prerequisite Fabric v2.4/v2.5 plus Four Roots diff. Preserve
both sides of the one known overlapping README path if it conflicts. Then
rerun all commands in this receipt, the full Four Roots package test, and the
live render/click/reload/restart journey. Mike may commit that reviewed merge
or run `git merge --abort`. This receipt authorizes neither action.

## Post-seal target recheck

The canonical HEAD remained `dadd8a9f87c2cf70a7c444244483ee853276e745`,
but three unrelated Foundation Planet paths became dirty after the main
session segment was sealed. A commit-to-commit `git merge-tree` simulation
against feature tip `b789c24b5bc25c804c6314064b8926d7e3588949`
completed without a textual conflict. See `TARGET_DRIFT_ADDENDUM.md` for the
exact paths, simulated tree, and truth limit. The busy canonical checkout must
not be used for integration.
