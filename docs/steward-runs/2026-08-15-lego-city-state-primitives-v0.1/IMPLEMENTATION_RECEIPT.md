# LEGO City state primitives v0.1 implementation receipt

Status: **EXPERIMENTAL — WORKING IN FOCUSED TESTS**

Phase 2 adds the Content-Addressed Artifact Depot and Event Journal.

- City graph: `b44ea7f440321095bf3b9b71891c9780570b4795f609225efa438e9502599afb`.
- Schema registry: `d8c32ee9d983cc1f19d5511bff750d20217649ddb6ce5b900acb4bcb43ab8bc9`.
- Artifact Depot assertions: 10 passed.
- Event Journal assertions: 9 passed.

Proven here: atomic promotion of complete artifact bytes from partial paths,
digest and size verification, idempotent duplicate puts, ignored interrupted
partials, inert leases/exports, hash-chain verification, correlation/causation
retention, deterministic replay, and refusal of incomplete or tampered journal
tails.

Not claimed here: crash consistency beyond the tested local filesystem
operations, multi-process throughput, distributed consensus, automatic repair,
artifact safety, artifact execution, deletion, garbage collection, promotion,
merge, or CANON.
