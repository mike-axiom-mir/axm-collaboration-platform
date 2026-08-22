# Local Intake Card — Proof Dependency Graph

- **Module ID:** `axm.verify.proof-dependency-graph`
- **Seed:** 092/100
- **Family:** 10. Governance, independent review, release proof, and orchestration
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/proof_dependency_graph.py`
- **Primary class:** `ProofDependencyGraph`
- **Operation:** `build`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Represent typed proof dependencies across claims, artifacts, environments, sources, receipts, and human judgments while exposing missing nodes and cycles.

## Optional upstream organs

- `axm.verify.claim-source-trace-binder`
- `axm.verify.requirement-traceability-graph`
- `axm.verify.test-run-receipt-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
