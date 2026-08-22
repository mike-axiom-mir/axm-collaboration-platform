# Local Intake Card — Contract Conformance Harness

- **Module ID:** `axm.verify.contract-conformance-harness`
- **Seed:** 031/100
- **Family:** 4. Static, dynamic, formal, and generative testing
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/contract_conformance_harness.py`
- **Primary class:** `ContractConformanceHarness`
- **Operation:** `evaluate`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Check exact schema, operation, lifecycle, and refusal-state conformance without executing the target system.

## Optional upstream organs

- `axm.verify.acceptance-criterion-compiler`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
