# Local Intake Card — Claim Scope and Context Binder

- **Module ID:** `axm.verify.claim-scope-context-binder`
- **Seed:** 002/100
- **Family:** 1. Claim, requirement, and source truth
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/claim_scope_context_binder.py`
- **Primary class:** `ClaimScopeContextBinder`
- **Operation:** `bind`
- **Reference tests:** 9
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Bind a typed claim to exact declared context without inventing or verifying context facts.

## Optional upstream organs

- `axm.verify.typed-claim-registry`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
