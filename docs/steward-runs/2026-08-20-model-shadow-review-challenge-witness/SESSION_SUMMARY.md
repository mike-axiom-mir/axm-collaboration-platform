# Model Shadow review challenge checkpoint witness session summary

Status: `TEST`

## Outcome

This session adds a read-only checkpoint witness leaf after the Model Shadow
review challenge continuity observer. It verifies checkpoint-specific detached
Ed25519 signatures and makes the exact witnessed checkpoint drive a later
continuity comparison.

Fresh-process fixtures distinguish exact state, forward extension, missing
challenge state, invalid current state, whole-namespace absence, and ledger
identity drift after rebuilding the witness package.

## Truth and authority decisions

- Signatures prove possession of keys admitted by the exact caller policy.
- A replacement caller policy with its own keys also verifies and creates a
  distinct witness. Host trust and real-world signer identity remain unproven.
- The runtime leaf accepts only public keys and has no filesystem, network,
  process-execution, install, promotion, merge, Foundation, or `CANON` route.
- A fresh process reading a temporary package proves reload behavior, not
  independent external retention or protected storage.
- Detection relative to a witnessed checkpoint is not rollback prevention,
  global single-use, actual human review, provider execution, evaluation,
  benefit, or learning evidence.

## Evidence

- The capability comparator records twelve required missing capabilities before
  and zero afterward, while all eight protected/external routes remain optional
  unknown.
- `SOURCE_SNAPSHOT.json` binds twenty normalized implementation and upstream
  contract inputs.
- `CHECK_RESULTS.json` records focused and AGENTS.md commands without retaining
  passing stdout.
- `SESSION_SEGMENT.jsonl` plus its seal preserves the policy-substitution
  counterexample and authority decisions.

## Open seams

Host-promoted checkpoint trust, actual external retention, protected monotonic
storage, authenticated signer identity, trusted time, global challenge
authority, actual human review, provider execution, evaluation, held-out human
benefit, and learning remain `UNKNOWN` / `NOT_RUN`. Mike remains merge and
`CANON` gate.
