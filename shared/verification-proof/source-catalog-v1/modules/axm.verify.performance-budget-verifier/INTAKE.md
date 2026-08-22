# Local Intake Card — Performance Budget Verifier

- **Module ID:** `axm.verify.performance-budget-verifier`
- **Seed:** 056/100
- **Family:** 6. Visual, interaction, performance, and native proof
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/performance_budget_verifier.py`
- **Primary class:** `PerformanceBudgetVerifier`
- **Operation:** `verify`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Evaluate latency, throughput, frame time, startup, memory, storage, and compute samples against explicit workload budgets.

## Optional upstream organs

- `axm.verify.hermetic-environment-descriptor`
- `axm.verify.statistical-tolerance-oracle`
- `axm.verify.test-run-receipt-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
