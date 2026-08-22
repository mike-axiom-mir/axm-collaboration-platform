# Local Intake Card — Statistical Confidence and Uncertainty Reporter

- **Module ID:** `axm.verify.statistical-confidence-reporter`
- **Seed:** 085/100
- **Family:** 9. Benchmarking, evaluation, and comparative proof
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/statistical_confidence_reporter.py`
- **Primary class:** `StatisticalConfidenceReporter`
- **Operation:** `report`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Report repetitions, missingness, central tendency, sample variance, normal-approximation intervals, flagged outliers, and effect sizes without false precision.

## Optional upstream organs

- `axm.verify.baseline-reference-comparator`
- `axm.verify.statistical-tolerance-oracle`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
