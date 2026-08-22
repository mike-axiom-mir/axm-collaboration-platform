# Local Intake Card — Test Run Receipt Builder

- **Module ID:** `axm.verify.test-run-receipt-builder`
- **Seed:** 030/100
- **Family:** 3. Deterministic execution and fixtures
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/test_run_receipt_builder.py`
- **Primary class:** `TestRunReceiptBuilder`
- **Operation:** `build`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Create and reverify canonical receipts for one bounded test run.

## Optional upstream organs

- `axm.verify.golden-fixture-registry`
- `axm.verify.hermetic-environment-descriptor`
- `axm.verify.invariant-oracle`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
