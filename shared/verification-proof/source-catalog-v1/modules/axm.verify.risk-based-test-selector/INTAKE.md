# Local Intake Card — Risk-Based Test Selector

- **Module ID:** `axm.verify.risk-based-test-selector`
- **Seed:** 044/100
- **Family:** 5. Coverage, selection, compatibility, and blind spots
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/risk_based_test_selector.py`
- **Primary class:** `RiskBasedTestSelector`
- **Operation:** `select`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Select bounded tests using explicit risk dimensions, weights, costs, and mandatory constraints.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
