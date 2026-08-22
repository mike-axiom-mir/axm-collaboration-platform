# Grounded-growth frontier audit for v3.2

Status: `TEST` design freeze

## Observed frontier

v3.1 exact-rebuilds a v2.9 request and pending handoff plus one later
caller-presented Review Inbox item. It emits a minimized `APPROVED`, `HOLD`, or
`REJECTED` outcome with pseudonymous vote evidence and no consequential
authority. The output is deterministic but ephemeral: no current leaf preserves
that exact-rebuilt outcome after the complete caller package and its v2.8
observation root are unavailable.

Review outcomes are consequential evidence even when they authorize nothing.
Dropping them weakens continuity; storing the complete caller package would
retain raw actor strings and vote notes that v3.1 deliberately omits. The
cheapest honest route is therefore a local append-only ledger that exact-rebuilds
v3.1 before capture and persists only its minimized output.

## Bounded v3.2 seam

Add `shared/model-shadow-retention-audit-review-outcome-ledger` which:

1. requires an exact v3.1 input/outcome package and an explicit unauthenticated
   capture confirmation;
2. requires its caller-owned ledger root to be distinct and nonnested from the
   upstream v2.8 observation root used during exact rebuild;
3. exclusive-creates and file-syncs one fixed manifest and contiguous canonical
   record files beneath one fixed namespace;
4. persists the complete minimized v3.1 output but not the complete v3.1 input,
   raw Review Inbox item, raw actors, vote notes, discussion, or configured
   paths;
5. preserves `APPROVED`, `HOLD`, and `REJECTED` as observations without
   adjudicating them or resolving the retention hold;
6. binds manifest, sequence, previous-record digest, outcome digest, caller
   time, and self-digest for every record;
7. refuses duplicate record ids, outcome ids, or outcome digests, non-forward
   times, corrupt or noncanonical bytes, gaps, extras, stale locks, overlaps,
   oversized inputs, aggregate overflow, and concurrent duplicate writers;
8. reloads and verifies exact stored records in a fresh process without the
   upstream v2.8 observation root;
9. states that reload validates stored pseudonymous bytes but does not re-prove
   actor-digest derivation from raw caller actors after the input is absent;
10. exposes bounded counts and latest references through a self-digested
    snapshot;
11. performs no Review Inbox mutation, provider call, evaluation, remediation,
    execution, adoption, promotion, merge, Foundation mutation, or `CANON`; and
12. preserves joint upstream-and-ledger loss, local-controller replacement,
    directory-entry, device, hardware, power-loss, external-retention, and
    protected-monotonic-state counterevidence.

## Decisive counterevidence

- Exact rebuild happens only before capture; later reload cannot independently
  reconstruct raw actor strings from their digests.
- Exclusive create plus file `fsync` does not prove the directory entry, device
  cache, hardware, or power-loss durability.
- A caller-owned local root is not independent custody, external retention, or
  protected monotonic storage.
- Deleting or jointly replacing the upstream observation root and this ledger
  defeats the original local continuity boundary.
- An explicit confirmation string authenticates no host, actor, human,
  organization, or policy.
- Persisting `APPROVED` does not resolve the retention hold or authorize any
  remediation or execution.
- Synthetic captures prove no live host observation, actual review, benefit,
  learning, adoption, promotion, merge, or `CANON`.

Mike Tobi / AXM remains the merge and `CANON` gate.
