# Model Shadow review challenge anchor gate session summary

Status: `TEST`

## Outcome

This session adds an uninstalled read-only anchor gate after the v0.4 signed
checkpoint witness. It requires a separate threshold of anchor authorizations
over the exact witness, witness policy, checkpoint, ledger state, anchor policy,
and caller-presented expected anchor digest before continuity comparison.

Fresh-process fixtures distinguish exact state, forward extension, missing
challenge state, invalid current state, whole-namespace absence, and ledger
identity drift after rebuilding the full anchored chain.

## Truth and authority decisions

- A replacement witness policy cannot reuse the original anchor signatures while
  the presented anchor and expected digest remain fixed.
- A replacement anchor plus replacement pin and new signatures creates a
  different valid chain. The anchor and pin are therefore not authenticated
  Mike or host authority.
- Anchor signatures prove possession of keys admitted by the exact anchor policy;
  they do not prove real-world identity or actual human participation.
- The anchor epoch is self-declared, not protected monotonic state. Reload from a
  temporary package is not independent external retention or protected storage.
- The runtime has no filesystem, network, process-execution, install, promotion,
  merge, Foundation, or `CANON` route.
- Detection relative to the anchored checkpoint is not rollback prevention,
  global single-use, actual review, provider execution, evaluation, benefit, or
  learning evidence.

## Evidence

- The capability comparator records fourteen new required capabilities missing
  before and zero afterward, while all eight external or authority routes remain
  optional unknown and the overall state remains `DEGRADED`.
- `SOURCE_SNAPSHOT.json` binds twenty-nine normalized implementation and upstream
  contract inputs.
- `CHECK_RESULTS.json` records 23 passing commands and 664 focused assertions
  without retaining passing stdout.
- `SESSION_SEGMENT.jsonl` plus its seal preserves two evidence-assertion failures,
  the fixed-pin result, and the joint-substitution counterexample.

## Open seams

Host-authenticated anchor pinning, actual external retention, protected monotonic
storage, authenticated signer identity, trusted time, global challenge
authority, actual human review, provider execution, evaluation, held-out human
benefit, and learning remain `UNKNOWN` / `NOT_RUN`. Mike remains merge and
`CANON` gate.
