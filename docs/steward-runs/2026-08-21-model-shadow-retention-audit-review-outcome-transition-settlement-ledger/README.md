# v3.7 review-outcome transition-settlement evidence

Status: `TEST` · installed: `false` · promoted: `false`

This folder binds the v3.7 normalized source snapshot, deterministic capability
comparison, 55-command verification receipt, five claim-to-evidence routes, and
a sealed ordered session segment.

The bounded result is a caller-invoked two-phase local adapter. Proposal requires
an exact persisted v3.6 entry with equal bracketing source snapshots and does not
advance the settled head. Settlement separately rebuilds the exact pending
proposal, rechecks the source, and writes either an exact head-advancing receipt
or a typed held receipt that preserves the prior head. All five observation and
settlement classifications execute in the focused suite.

Successful returns require exclusive canonical file creation, file `fsync`, and
exact local reload. A failed file `fsync` can still leave an inspectable proposal
or settlement. The last source observation is prewrite, is not atomic with the
following write, and proves no postwrite currentness.

This is local serialization evidence only. Independent caller-owned root pairs
can settle divergent candidates, and jointly replacing source and settlement
state can reopen sequence one. The evidence proves no external custody, global
uniqueness, withheld-branch exclusion, protected monotonic storage, rollback
prevention, trusted time, directory or hardware durability, authenticated host
or actor, actual human review, external settlement, provider work, benefit,
learning, execution, adoption, promotion, merge, Foundation mutation, or CANON.

Browser verification: not applicable. No browser surface changed.

Independent Draft 2020-12 schema meta-validation: unrun. Runtime validation and
recursive closed-object topology checks passed, but no independent validator was
available in the declared tool inventory.

Mike Tobi / AXM remains the merge and `CANON` gate.
