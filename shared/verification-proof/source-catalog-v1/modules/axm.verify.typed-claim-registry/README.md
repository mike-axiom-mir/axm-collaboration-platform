# Typed Claim Registry

Detached AXM Verification & Proof organ for seed 001.

It stores the exact shape of a claim before proof routing begins. It deliberately does **not** decide whether the claim is true, sufficient, releasable, or CANON.

## Truth boundaries

- Claim IDs are immutable once registered.
- Duplicate IDs are refused rather than overwritten.
- The seven canonical verdict states remain distinct.
- Scope is a structured object; proof surfaces are an explicit non-empty list.
- Storage is append-only JSONL.
- Snapshots are deterministic and sorted by claim ID.
- No timestamps are invented by the module.

## Reference API

- `validate_claim(claim)`
- `TypedClaimRegistry(path).register(claim)`
- `get(claim_id)`
- `list_claims()`
- `snapshot()`

Status: TEST-HOLD, detached, v0.1.0.
