# Local Intake Card — Signature and Keyless Identity Verifier

- **Module ID:** `axm.verify.signature-keyless-verifier`
- **Seed:** 068/100
- **Family:** 7. Provenance, attestations, and reproducible artifacts
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/signature_keyless_verifier.py`
- **Primary class:** `SignatureKeylessVerifier`
- **Operation:** `evaluate`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Evaluate caller-supplied signature, certificate, identity, trust-root, validity, revocation, and transparency evidence against explicit policy.

## Optional upstream organs

- `axm.verify.transparency-log-inclusion-proof`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
