# Local Intake Card — Typed Claim Registry

- **Module ID:** `axm.verify.typed-claim-registry`
- **Seed:** 001/100
- **Family:** 1. Claim, requirement, and source truth
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/typed_claim_registry.py`
- **Primary class:** `TypedClaimRegistry`
- **Operation:** `register`
- **Reference tests:** 10
- **Side effects:** optional append-only local JSONL at a caller-supplied path

## Purpose

Store typed claims without silent overwrite or approval authority.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
