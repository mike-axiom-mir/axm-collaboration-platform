# Local Intake Card — SLSA Expectation Verifier

- **Module ID:** `axm.verify.slsa-expectation-verifier`
- **Seed:** 066/100
- **Family:** 7. Provenance, attestations, and reproducible artifacts
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/slsa_expectation_verifier.py`
- **Primary class:** `SLSAExpectationVerifier`
- **Operation:** `verify`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Compare a supplied provenance record against explicit builder, source, build-type, parameter, dependency, and completeness expectations.

## Optional upstream organs

- `axm.verify.in-toto-attestation-adapter`
- `axm.verify.source-artifact-provenance-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
