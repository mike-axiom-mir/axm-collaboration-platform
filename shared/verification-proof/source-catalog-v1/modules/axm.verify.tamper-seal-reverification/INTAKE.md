# Local Intake Card — Tamper and Seal Reverification

- **Module ID:** `axm.verify.tamper-seal-reverification`
- **Seed:** 074/100
- **Family:** 8. Evidence integrity, custody, privacy, and portability
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/tamper_seal_reverification.py`
- **Primary class:** `TamperSealReverification`
- **Operation:** `reverify`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Recompute exact subject digests, reference existence, and supplied signature-verification states instead of trusting stored verdict fields.

## Optional upstream organs

- `axm.verify.artifact-identity-hasher`
- `axm.verify.canonical-evidence-serializer`
- `axm.verify.signature-keyless-verifier`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
