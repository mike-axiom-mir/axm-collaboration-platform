# Local Intake Card — Exact Expected-Output Oracle

- **Module ID:** `axm.verify.exact-output-oracle`
- **Seed:** 013/100
- **Family:** 2. Evidence sufficiency and test oracles
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/exact_output_oracle.py`
- **Primary class:** `ExactOutputOracle`
- **Operation:** `evaluate`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Compare deterministic outputs by an explicit exact representation and emit bounded mismatch evidence.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
