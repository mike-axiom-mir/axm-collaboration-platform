# Module 1 Intake Delta Report

## What the handoff changed

The real Module 1 handoff did not invalidate Module 3's roots, graph, signal
metabolism or transaction boundary. It did invalidate several fixture-level
assumptions:

| Earlier fixture assumption | Real Module 1 handoff | Adapter response |
|---|---|---|
| Module ID is `axm:module:human-capability-atlas` | Canonical ID is `axm.module.human_capability_atlas` | Explicit external/local identity binding; no rewrite |
| Incoming Module 1 carries a Capability Card payload | Real registry run is `NOT_RUN`; cards are generated locally | Two-stage package admission then materialization |
| Evidence arrives as a standalone packet/tuple | Evidence is distributed across records, sidecars and receipts | Composite immutable evidence index |
| Same ID + different card hash means conflict | Timestamps/run IDs can change full hashes while semantics stay equal | Semantic digest classifier |
| One ZIP probe is enough | Outer bundle contains independently hashed nested ZIPs | Nested hash and path verification |
| `MERGE_READY` can follow structural package preflight | Package may be valid while corpus does not exist | Materialization-required status; deferred cross-checks |
| Visual counts/tokens are usable facts | 342/689 and `CONFIRMED` were presentation-only | Explicitly disconfirmed as machine authority |

## Result

One narrow adapter pass was justified. A broad redesign was not. The established
v0.6 body remains byte-identical; all new behavior is a pre-intake sidecar until
real artifact bytes and local run evidence arrive.
