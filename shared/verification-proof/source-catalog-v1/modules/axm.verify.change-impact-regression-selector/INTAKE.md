# Local Intake Card — Change-Impact Regression Selector

- **Module ID:** `axm.verify.change-impact-regression-selector`
- **Seed:** 045/100
- **Family:** 5. Coverage, selection, compatibility, and blind spots
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/change_impact_regression_selector.py`
- **Primary class:** `ChangeImpactRegressionSelector`
- **Operation:** `select`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Select regression tests from a bounded caller-supplied change-impact graph.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
