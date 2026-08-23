# Game Production Runner v0.1 — implementation receipt

Date: 2026-08-09  
Branch: `codex/game-production-runner-v0.1`  
Status: **EXPERIMENTAL**

## Outcome

The intake has been integrated as a new leaf core plus CLI module. It establishes
the control plane between a locked game intent and bounded candidate work:

- versioned intent, package, graph, plan, receipt, and run contracts;
- canonical SHA-256 identity and exact-digest binding;
- deterministic topological compilation with typed capability holds;
- explicit serial execution in an absolute external candidate root;
- declared-output-only writes, byte limits, attempt limits, and timeouts;
- producer/verifier separation and independently bound verification receipts;
- append-only digest-chained step receipts, atomic state, cancellation,
  interruption, receipt-bound resume, artifact-tamper holds, and junction-aware
  source-tree isolation;
- read-only seams for Game Organism, Verification Spine, Game Hub, and the local
  Godot substrate resolver;
- a five-package inert Proofyard fixture used only to prove runner mechanics.

No existing shared subsystem was edited. No runtime was installed. No native
game, Hub installation, promotion, CANON transition, release, or network action
was performed.

## Claim-to-evidence matrix

| Claim | Evidence route | Result | Limit |
|---|---|---:|---|
| Contracts reject malformed, contradictory, or unsealed inputs | Focused executable unit tests | PASS | Runtime validators are module-owned; independent JSON Schema standards validation remains open. |
| Compilation is deterministic and fails closed on missing capability | Repeated exact plan compilation and digest checks | PASS | Fixture inventory only. |
| Candidate writes remain outside the source tree and inside declared outputs | Temporary-root execution, escape/refusal, and output enumeration tests | PASS | In-process fixture executors only. |
| Verification is identity- and subject-bound | Separate verifier registry plus forged/mismatched receipt tests | PASS | Not a native engine verifier. |
| Interrupted work resumes only from unchanged artifacts | Interruption, resume, receipt-chain, and tamper tests | PASS | Single-process serial runner. |
| Existing AXM seams can be inspected without acquiring authority | Discovery seam review | PASS | Read-only adapters; no install handoff. |
| Proofyard is a working native game | Native runtime plus live visual/gameplay evidence | UNKNOWN | Godot substrate and native executor/verifier are missing. |
| AXM is better than Unreal | Comparative benchmark program | UNKNOWN | No comparison contract or evidence exists yet. |

## Verification

Module-focused checks:

- `node shared/game-production-runner/selftest.js` — PASS, 49 checks.
- `node tools/game-production-runner/selftest.js` — PASS, 22 checks.
- `node tools/game-production-runner/discovery-seam-review.js` — PASS, 7 checks.
- `node verify.js` — PASS, 0 failures; 38 pre-existing warnings.

The generated `tools-index.json` was not committed. Regeneration would rewrite
1,613 lines for pre-existing index normalization, which is not attributable to
this leaf. The live manifest scan discovers and validates the runner; a shared
index refresh remains a separate ownership lane.

Relevant subsystem regressions:

- Game Organism, Gameplay Organ, Verification Spine, Game Forge, package service,
  and Game Hub package verifier — PASS.
- Asset Hands substrate-pack self-test — FOREIGN FAILURE: existing diagnostic
  returned `null` where the test expects `MISSING_SUBSTRATE`; this branch has no
  changes under that subsystem.

Required workshop checks:

- Route, graft, skin, verify-plus, HTML script syntax, tool packaging,
  Agent Tool Forge, and Evidence Desk — PASS.
- Hub self-test — FOREIGN FAILURE, 3 existing checks: station source map,
  incremental measurement reuse, and responsive command-bar polish. This branch
  has no changes under `hub/`, `launcher/`, or their presentation surfaces.

## Capability ceiling

The branch is useful now as a trustworthy orchestration foundation, not yet as
a native game factory. The typed open gaps and the evidence required to close
them are recorded in `CAPABILITY_GAP_REPORT.json` beside this receipt.

Human review remains the authority boundary for native execution, candidate
acceptance, installation, promotion, CANON, and release.
