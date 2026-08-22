# AXM LEGO City Owner-Defined Local Sync

Status: **EXPERIMENTAL**

Local Sync is a pure candidate compiler. Every namespace must have an explicit
owner-defined merge rule. v0.1 supports append-only lists and a measured
grow-only set; it refuses generic “CRDT” claims. Immutable divergence conflicts,
last-writer selection is refused, and single-authority divergence waits for the
owner.

Foundation, CANON, root, and authority namespaces always produce a digest-bound
human reconciliation request. Results are never applied or persisted here.
