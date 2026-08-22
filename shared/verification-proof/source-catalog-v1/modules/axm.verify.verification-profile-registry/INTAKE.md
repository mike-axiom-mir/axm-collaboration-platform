# Local Intake Card — Verification Profile Registry

- **Module ID:** `axm.verify.verification-profile-registry`
- **Seed:** 091/100
- **Family:** 10. Governance, independent review, release proof, and orchestration
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/verification_profile_registry.py`
- **Primary class:** `VerificationProfileRegistry`
- **Operation:** `register`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Register target-specific required claims, specialist verifiers, tolerances, evidence surfaces, and release thresholds as immutable detached profiles.

## Optional upstream organs

- `axm.verify.claim-proof-surface-router`
- `axm.verify.evidence-sufficiency-policy`
- `axm.verify.typed-claim-registry`
- `axm.verify.verdict-state-normalizer`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
