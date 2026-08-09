# AXM Game Production Runner Core v0.1

Status: **EXPERIMENTAL · candidate branch**

This leaf module proves the control layer between a locked game intent and
bounded production work. It validates exact-digest package graphs, compiles a
serial execution plan, runs explicitly selected in-process Hands in an
external candidate root, requires a separately identified verifier, preserves
append-only step receipts, and resumes only from verified artifacts whose
bytes still match.

It does not build Proofyard in Godot yet. The included Proofyard foundation is
an inert fixture that proves runner behavior, not native gameplay. Godot remains
behind the existing substrate resolver and a separate explicit native gate.

## Current truth ceiling

- Contract and graph behavior: executable and self-tested.
- Isolated declarative fixture execution: executable and self-tested.
- Restart/resume, digest-chained ledger validation, and tamper holds: executable
  and self-tested.
- AXM adapter discovery: read-only.
- Native Godot production: `MISSING_SUBSTRATE` until separately resolved.
- Game quality, feel, and superiority over another engine: human/future evidence.

## Boundaries

- Exact phrase `RUN GAME PRODUCTION CANDIDATE` is required for every run or
  resume.
- Candidate job roots must be absolute and outside the source tree.
- Symbolic links and junctions cannot disguise the source tree as a job root.
- Only declared output paths are written.
- Fixture executors return bytes to the runner; they receive no output path.
- A package cannot appoint its executor as verifier.
- Missing or contradictory evidence holds the run.
- No install, Game Hub copy, promotion, CANON, release, or network authority.

Run the shared and tool tests from the Workshop root:

```powershell
node shared/game-production-runner/selftest.js
node tools/game-production-runner/selftest.js
```
