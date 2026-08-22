# Local Intake Card — Metric Gaming and Goodhart Warning

- **Module ID:** `axm.verify.metric-gaming-warning`
- **Seed:** 088/100
- **Family:** 9. Benchmarking, evaluation, and comparative proof
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/metric_gaming_warning.py`
- **Primary class:** `MetricGamingWarning`
- **Operation:** `assess`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Warn when proxy gaps, metric concentration, missing guardrails, threshold cliffs, or unbounded high-pressure optimization could detach a metric from the human goal.

## Optional upstream organs

- `axm.verify.benchmark-contract-builder`
- `axm.verify.multi-objective-scorecard`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
