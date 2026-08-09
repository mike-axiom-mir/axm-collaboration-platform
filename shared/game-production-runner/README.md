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

The portable production profile is a bounded adapter experiment. It accepts
neutral intent, package, and graph schemas and binds them to the unchanged game
runner internally. A documentation fixture proves cross-domain orchestration
mechanics; it does not prove that the core is already universal. New portable
runs emit `axm.production-step-receipt/v1` ledgers whose schema is bound into
state and terminal receipts. Pre-upgrade portable runs that already began with
game-scoped receipts continue that same schema explicitly; a ledger is never
silently mixed during resume.

The content-verified documentation profile goes beyond fixture testimony. Its
Hand deterministically renders a release note from a locked brief, while a
separately identified verifier reads declared dependency and output bytes
through copy-returning runner APIs. Executor-supplied facts cannot make malformed
bytes pass. This proves content-derived verification inside the trusted
in-process registry; it is not an operating-system process sandbox.

The confinement substrate probe is a separate, explicit diagnostic. It launches
disposable permission-mode child processes, tests individual filesystem,
child-process, worker-thread, and local-loopback capabilities, removes its
temporary root, and seals the observations. On the supported local Node 24
runtime, filesystem access, child processes, and worker threads were denied but
loopback networking remained allowed. The resulting status is therefore
`DEGRADED`, process-Hand activation stays on `HOLD`, and untrusted code remains
refused. Node permission mode is treated as accidental-capability containment,
not as a security boundary for malicious code.

## Current truth ceiling

- Contract and graph behavior: executable and self-tested.
- Isolated declarative fixture execution: executable and self-tested.
- Restart/resume, digest-chained ledger validation, and tamper holds: executable
  and self-tested.
- AXM adapter discovery: read-only.
- Portable non-game profile adaptation: executable and self-tested with an
  explicit evidence ceiling.
- Neutral portable step receipts: executable and self-tested across clean runs,
  interrupted resume, schema tamper, and legacy game-ledger continuation.
- Content-derived documentation verification: executable and self-tested,
  including a deliberately lying executor and undeclared-read refusal.
- Explicit Hand confinement substrate diagnosis: executable and self-tested;
  the current Node 24 observation is `DEGRADED` because network denial failed.
- Process-hosted production Hands and a malicious-code sandbox: missing.
- Native Godot production: `MISSING_SUBSTRATE` until separately resolved.
- Game quality, feel, and superiority over another engine: human/future evidence.

## Boundaries

- Exact phrase `RUN GAME PRODUCTION CANDIDATE` is required for every run or
  resume.
- Portable profiles require their distinct phrase `RUN PRODUCTION CANDIDATE`;
  adapting a profile grants no execution authority.
- Candidate job roots must be absolute and outside the source tree.
- Symbolic links and junctions cannot disguise the source tree as a job root.
- Only declared output paths are written.
- Fixture executors return bytes to the runner; they receive no output path.
- A package cannot appoint its executor as verifier.
- Appointed verifiers may read copies of declared output bytes and direct
  dependency bytes; undeclared reads fail the attempt.
- Missing or contradictory evidence holds the run.
- A run's step receipt schema is pinned before the first receipt and rechecked
  on every resume.
- Confinement probing is opt-in, local-loopback-only, and grants no execution
  authority even if every check passes.
- Any required capability that is allowed or unknown holds process-Hand
  activation; a separate explicit gate would still be required after a pass.
- No install, Game Hub copy, promotion, CANON, release, or external-network
  authority. The explicit diagnostic declares its temporary loopback-listener
  power separately.

Run the shared and tool tests from the Workshop root:

```powershell
node shared/game-production-runner/selftest.js
node tools/game-production-runner/selftest.js
```
