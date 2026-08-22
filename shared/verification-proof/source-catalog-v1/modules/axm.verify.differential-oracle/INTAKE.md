# Local Intake Card — Differential Oracle

- **Module ID:** `axm.verify.differential-oracle`
- **Seed:** 016/100
- **Family:** 2. Evidence sufficiency and test oracles
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/differential_oracle.py`
- **Primary class:** `DifferentialOracle`
- **Operation:** `evaluate`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Cluster outputs from multiple named implementations to expose agreement, disagreement, and missing observations without selecting a winner.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
