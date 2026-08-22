# Local Intake Card — SBOM and License Evidence Verifier

- **Module ID:** `axm.verify.sbom-license-verifier`
- **Seed:** 067/100
- **Family:** 7. Provenance, attestations, and reproducible artifacts
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/sbom_license_verifier.py`
- **Primary class:** `SBOMLicenseVerifier`
- **Operation:** `verify`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Validate bounded SBOM component identities, relationships, hashes, licenses, required components, and completeness declarations.

## Optional upstream organs

- `axm.verify.artifact-identity-hasher`
- `axm.verify.source-artifact-provenance-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
