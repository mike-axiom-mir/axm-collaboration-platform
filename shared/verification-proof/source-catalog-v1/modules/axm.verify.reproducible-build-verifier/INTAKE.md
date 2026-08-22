# Local Intake Card — Reproducible Build Verifier

- **Module ID:** `axm.verify.reproducible-build-verifier`
- **Seed:** 064/100
- **Family:** 7. Provenance, attestations, and reproducible artifacts
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/reproducible_build_verifier.py`
- **Primary class:** `ReproducibleBuildVerifier`
- **Operation:** `verify`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Compare two or more supplied build receipts for bit-identical specified outputs under the same declared source, environment, and instructions.

## Optional upstream organs

- `axm.verify.artifact-identity-hasher`
- `axm.verify.build-environment-capture`
- `axm.verify.source-artifact-provenance-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
