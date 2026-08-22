# Local Intake Card — Runtime Sanitizer Adapter

- **Module ID:** `axm.verify.runtime-sanitizer-adapter`
- **Seed:** 037/100
- **Family:** 4. Static, dynamic, formal, and generative testing
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/runtime_sanitizer_adapter.py`
- **Primary class:** `RuntimeSanitizerAdapter`
- **Operation:** `normalize`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Convert runtime sanitizer observations into typed bounded evidence receipts.

## Optional upstream organs

- `axm.verify.test-run-receipt-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
