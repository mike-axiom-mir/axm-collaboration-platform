# Local Intake Card — Proof Freshness and Expiry Policy

- **Module ID:** `axm.verify.proof-freshness-expiry-policy`
- **Seed:** 010/100
- **Family:** 1. Claim, requirement, and source truth
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/proof_freshness_expiry_policy.py`
- **Primary class:** `FreshnessPolicy`
- **Operation:** `evaluate`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Evaluate proof relevance against declared age and context invalidators.

## Optional upstream organs

- `axm.verify.claim-scope-context-binder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
