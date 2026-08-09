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

Cross-run artifact reuse is opt-in through an absolute external cache root.
Only an executor that declares `deterministic-v1` is eligible. Cache keys bind
the exact package digest, dependency package/path/digest/byte descriptors,
executor, verifier, and a digest of the seed. Entries are immutable and
published atomically. A hit verifies the entry manifest and every artifact byte,
then runs the currently appointed verifier again before the output can enter a
candidate. Tamper or verifier disagreement is recorded as `REJECTED` and falls
back to fresh execution. Same-key/different-result publication is preserved as
a conflict instead of overwriting prior evidence.

Cache retention is a separate on-demand governor, never part of candidate
execution. Its inventory is read-only and bounded by entry/file scan limits.
It classifies only exact sealed cache layouts as temporary captures, measures
logical file bytes, and holds on undeclared content, links, special files, or
an active publisher. A dry-run policy independently limits entry count,
logical bytes, and filesystem age while protecting exact referenced keys.
Application requires the sealed proposal's exact digest, separate explicit
authority, an unchanged inventory snapshot, exact selective invalidations, and
post-delete readback. Filesystem age is an observed modification-age signal,
not a claim about original publication time.

Protected references no longer need to be copied by hand. An explicit,
read-only discovery pass scans only direct run directories under a separate
external job root. It accepts fully sealed terminal run receipts only after
validating the complete bounded step ledger, one pinned step-receipt schema,
the digest chain, exact run binding, and the terminal receipt's complete list
of verified step digests. Only verified `HIT`, `MISS_STORED`,
`MISS_ENTRY_EXISTS`, and `MISS_CONFLICT` observations contribute protection.
The sealed result discloses digests and counts, never local paths or run IDs.
Any incomplete, linked, malformed, mixed-schema, over-limit, or contradictory
run holds authority for the whole set. Retention binds both cache key and exact
entry digest, then freshly rediscovers references at apply time; a changed
reference snapshot deletes nothing.

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
- Deterministic cross-run artifact reuse: executable and self-tested across
  cold miss, verified hit, tamper fallback, verifier disagreement, explicit
  invalidation, and concurrent publication.
- On-demand cache retention: executable and self-tested across bounded
  inventory, separate count/logical-byte/filesystem-age budgets, protected
  references, dry-run authority, stale proposals, malformed layouts, exact
  deletion, and post-delete readback.
- Terminal-ledger cache-reference discovery: executable and self-tested across
  game and portable schemas, limits, tamper, incomplete and mixed ledgers,
  conflicting entry digests, path privacy, and reference-snapshot races.
- Persisted retention policies, scheduling, leases, and authoritative
  nonterminal checkpoints: missing; cache and reference roots remain
  human-owned local state.
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
- Cache roots must be explicit, absolute, outside the source and disjoint from
  candidate job roots. A run without one performs no cache write.
- A cache hit never reuses prior verification testimony; the current verifier
  must pass the cached bytes again.
- Invalidation requires an exact digest key and separate explicit authority.
- Retention planning never deletes. Application requires a saved sealed
  proposal, its exact digest as approval, and an unchanged inventory snapshot.
- Protected keys, unclassified layouts, and active publishers cannot be
  retention-deletion candidates. Retention never runs during a candidate.
- Reference discovery is an explicit bounded read-only action. It grants
  protection only for complete terminal ledgers; interrupted or incomplete
  runs hold the derived set, and apply must rescan the same reference root.
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
