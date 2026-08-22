# Local Intake Card — in-toto Attestation Adapter

- **Module ID:** `axm.verify.in-toto-attestation-adapter`
- **Seed:** 065/100
- **Family:** 7. Provenance, attestations, and reproducible artifacts
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/in_toto_attestation_adapter.py`
- **Primary class:** `InTotoAttestationAdapter`
- **Operation:** `adapt`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Normalize an in-toto Statement-shaped attestation and bind its subjects to explicit expected identities and caller-supplied envelope verification status.

## Optional upstream organs

- `axm.verify.artifact-identity-hasher`
- `axm.verify.signature-keyless-verifier`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
