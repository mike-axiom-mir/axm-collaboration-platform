# Local Intake Card — Constraint and Solver Proof Adapter

- **Module ID:** `axm.verify.constraint-proof-adapter`
- **Seed:** 035/100
- **Family:** 4. Static, dynamic, formal, and generative testing
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/constraint_proof_adapter.py`
- **Primary class:** `ConstraintProofAdapter`
- **Operation:** `normalize_result`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Bridge bounded constraint obligations to SAT/SMT-style solvers without executing them or overstating solver evidence.

## Optional upstream organs

- `axm.verify.test-run-receipt-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
