# Local Intake Card — Baseline and Reference Comparator

- **Module ID:** `axm.verify.baseline-reference-comparator`
- **Seed:** 083/100
- **Family:** 9. Benchmarking, evaluation, and comparative proof
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/baseline_reference_comparator.py`
- **Primary class:** `BaselineReferenceComparator`
- **Operation:** `compare`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Compare candidate measurements against a named, versioned baseline while retaining configurations, ranges, uncertainty, direction, and practical thresholds.

## Optional upstream organs

- `axm.verify.benchmark-contract-builder`
- `axm.verify.statistical-tolerance-oracle`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
