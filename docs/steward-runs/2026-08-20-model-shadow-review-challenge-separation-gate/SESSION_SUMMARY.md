# Model Shadow review challenge separation gate session summary

Status: `TEST`

## Outcome

This session adds an uninstalled read-only separation gate after the v0.5
anchored checkpoint witness. It refuses an exact key fingerprint or declared
principal digest shared by the witness and anchor thresholds before allowing
the anchored checkpoint to drive continuity comparison.

Fresh-process fixtures distinguish exact state, forward extension, missing
challenge state, invalid current state, whole-namespace absence, and ledger
identity drift after rebuilding the separated chain.

## Truth and authority decisions

- Valid v0.5 fixtures prove the preexisting leaf permits both cross-layer public
  key reuse and cross-layer declared-principal reuse.
- v0.6 refuses those observable overlaps and retains only domain-separated set
  digests and counts in its receipt.
- One synthetic process controls every distinct key in a passing chain. Distinct
  keys therefore do not prove independent custody or controllers.
- Distinct caller-declared digests do not authenticate different people,
  organizations, devices, or governance seats. Non-overlap does not exclude
  collusion.
- The runtime has no filesystem, network, process-execution, install, promotion,
  merge, Foundation, or `CANON` route.
- Detection relative to the separated checkpoint is not rollback prevention,
  global single-use, actual review, provider execution, evaluation, benefit, or
  learning evidence.

## Evidence

- The capability comparator records nine new required capabilities missing
  before and zero afterward, while all eight external or authority routes remain
  optional unknown and the overall state remains `DEGRADED`.
- `SOURCE_SNAPSHOT.json` binds thirty-seven normalized implementation and
  upstream contract inputs.
- `CHECK_RESULTS.json` records 24 passing commands and 764 focused assertions
  without retaining passing stdout.
- `SESSION_SEGMENT.jsonl` plus its seal preserves both upstream overlap
  counterexamples and the same-controller nonindependence counterexample.

## Open seams

Host-authenticated anchor pinning, independently attested key custody and
controller identity, actual external retention, protected monotonic storage,
trusted time, global challenge authority, actual human review, provider
execution, evaluation, held-out human benefit, and learning remain `UNKNOWN` /
`NOT_RUN`. Mike remains merge and `CANON` gate.
