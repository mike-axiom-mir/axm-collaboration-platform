# Local Intake Card — Verdict State Normalizer

- **Module ID:** `axm.verify.verdict-state-normalizer`
- **Seed:** 004/100
- **Family:** 1. Claim, requirement, and source truth
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/verdict_state_normalizer.py`
- **Primary class:** `VerdictNormalizer`
- **Operation:** `normalize`
- **Reference tests:** 9
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Normalize explicit external verdict labels while preserving raw state and refusing false certainty.

## Optional upstream organs

- `axm.verify.typed-claim-registry`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
