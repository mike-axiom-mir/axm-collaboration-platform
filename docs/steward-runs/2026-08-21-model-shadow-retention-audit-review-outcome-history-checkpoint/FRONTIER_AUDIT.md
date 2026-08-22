# Grounded-growth frontier audit for v3.3

Status: `TEST` design freeze

## Observed frontier

v3.2 persists exact minimized v3.1 Review Inbox outcomes in one caller-owned
local ledger and reloads them after the upstream v2.8 observation root is gone.
Its chain fails closed on ordinary corruption, but a controller that replaces
the manifest and every record can construct another internally valid ledger.
When no earlier reference survives, the current v3.2 surface cannot distinguish
that replacement from the original local history.

The repository already demonstrates the cheapest honest pattern for this gap on
another ledger: a caller-portable, self-digested, full reference-sequence
checkpoint plus a later read-only relative-history audit. Reusing that pattern
through a bounded adapter is cheaper and more truthful than adding a second
writer, pretending a self-digest is external custody, or inventing an
authenticated reviewer.

## Bounded v3.3 seam

Add `shared/model-shadow-retention-audit-review-outcome-history-checkpoint`
which:

1. opens one exact configured v3.2 ledger and brackets one complete, single-load
   record-chain read with equal v3.2 snapshots;
2. emits a portable checkpoint containing the exact manifest and snapshot
   bindings, counts, endpoints, and every ordered record/outcome reference,
   time, and minimized classification;
3. omits complete v3.2 records and v3.1 outcomes, actor digests, vote evidence,
   raw actors, notes, discussion, paths, model output, and private context;
4. self-validates its closed shape, counts, ordered sequences, reference
   schemas, history commitment, truth boundary, and self-digest without the
   ledger root;
5. exact-rebuilds checkpoint origin only while the original v3.2 ledger is
   readable and unchanged across the bracketed presentation;
6. compares a caller-presented checkpoint with one later exact v3.2
   presentation as exact history, forward extension, strict rollback,
   replacement/fork, manifest identity drift, absence, or ledger/configuration
   invalidity;
7. treats every non-exact/non-forward result as a continuity hold and every
   result as review-only with zero autonomous actions;
8. demonstrates that retaining the original checkpoint detects a whole-ledger
   rewrite relative to that checkpoint;
9. also demonstrates that jointly replacing or withholding the checkpoint and
   ledger can establish another internally exact pair;
10. performs no durable write, Review Inbox mutation, provider call,
    evaluation, remediation, execution, adoption, promotion, merge, Foundation
    mutation, or `CANON`; and
11. preserves caller time, non-atomic bracketing, post-read movement, checkpoint
    retention, original origin, external custody, protected monotonic state,
    directory/device/hardware durability, and global consistency as unproven.

## Decisive counterevidence

- The module cannot prove that the caller retained the original checkpoint.
- A jointly replaced ledger and checkpoint remain internally valid.
- Equal before/after snapshots do not form an atomic filesystem snapshot and do
  not exclude intermediate change that reverts or change after the final read.
- A self-digest authenticates no host, steward, reviewer, human, organization,
  or policy.
- The checkpoint references outcomes but intentionally cannot reconstruct their
  omitted vote evidence or actor-digest provenance.
- Synthetic ledgers prove no live host observation, actual human review, hold
  resolution, provider execution, benefit, learning, adoption, or promotion.

Mike Tobi / AXM remains the merge and `CANON` gate.
