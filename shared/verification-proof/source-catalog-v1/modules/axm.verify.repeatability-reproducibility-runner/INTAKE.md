# Local Intake Card — Repeatability and Reproducibility Runner

- **Module ID:** `axm.verify.repeatability-reproducibility-runner`
- **Seed:** 086/100
- **Family:** 9. Benchmarking, evaluation, and comparative proof
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/repeatability_reproducibility_runner.py`
- **Primary class:** `RepeatabilityReproducibilityRunner`
- **Operation:** `assess`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Assess supplied repeated results within setups and across setups under one explicit tolerance.

## Optional upstream organs

- `axm.verify.benchmark-environment-normalizer`
- `axm.verify.statistical-confidence-reporter`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
