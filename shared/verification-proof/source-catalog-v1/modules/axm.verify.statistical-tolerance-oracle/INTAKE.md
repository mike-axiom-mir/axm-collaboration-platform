# Local Intake Card — Statistical and Tolerance Oracle

- **Module ID:** `axm.verify.statistical-tolerance-oracle`
- **Seed:** 019/100
- **Family:** 2. Evidence sufficiency and test oracles
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/statistical_tolerance_oracle.py`
- **Primary class:** `StatisticalToleranceOracle`
- **Operation:** `evaluate`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Evaluate finite numeric observations against explicit tolerance, sample-size, and proportion policies while reporting uncertainty.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
