# Local Intake Card — Claim-to-Proof Surface Router

- **Module ID:** `axm.verify.claim-proof-surface-router`
- **Seed:** 003/100
- **Family:** 1. Claim, requirement, and source truth
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/claim_proof_surface_router.py`
- **Primary class:** `ProofSurfaceRouter`
- **Operation:** `route`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Route declared proof surfaces to explicit specialist verifier registrations.

## Optional upstream organs

- `axm.verify.claim-scope-context-binder`
- `axm.verify.typed-claim-registry`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
