# Local Intake Card — Failure-Memory Regression Selector

- **Module ID:** `axm.verify.failure-memory-regression-selector`
- **Seed:** 046/100
- **Family:** 5. Coverage, selection, compatibility, and blind spots
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/failure_memory_regression_selector.py`
- **Primary class:** `FailureMemoryRegressionSelector`
- **Operation:** `select`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Select regression checks from verified failure memory while holding unreviewed, flaky, and rejected memories outside automatic use.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
