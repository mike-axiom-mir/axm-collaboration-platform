# Local Intake Card — Formal Model Checker Adapter

- **Module ID:** `axm.verify.formal-model-checker-adapter`
- **Seed:** 034/100
- **Family:** 4. Static, dynamic, formal, and generative testing
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/formal_model_checker_adapter.py`
- **Primary class:** `FormalModelCheckerAdapter`
- **Operation:** `create_request`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Bridge bounded formal models to external model checkers through explicit requests and typed result receipts.

## Optional upstream organs

- `axm.verify.test-run-receipt-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
