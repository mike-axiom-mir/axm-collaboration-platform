# Local Intake Card — Dependency Provenance Recursor

- **Module ID:** `axm.verify.dependency-provenance-recursor`
- **Seed:** 070/100
- **Family:** 7. Provenance, attestations, and reproducible artifacts
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/dependency_provenance_recursor.py`
- **Primary class:** `DependencyProvenanceRecursor`
- **Operation:** `inspect`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Traverse a caller-supplied dependency graph and expose missing, circular, failed, unverifiable, or policy-violating provenance links under a hard node bound.

## Optional upstream organs

- `axm.verify.in-toto-attestation-adapter`
- `axm.verify.slsa-expectation-verifier`
- `axm.verify.source-artifact-provenance-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
