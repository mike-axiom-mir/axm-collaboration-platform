# Local Intake Card — Independent Verifier Seat Router

- **Module ID:** `axm.verify.independent-verifier-seat-router`
- **Seed:** 093/100
- **Family:** 10. Governance, independent review, release proof, and orchestration
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/independent_verifier_seat_router.py`
- **Primary class:** `IndependentVerifierSeatRouter`
- **Operation:** `route`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Route an evidence-review request only to available specialist seats that satisfy capabilities, exclusions, conflict domains, and declared independence requirements.

## Optional upstream organs

- `axm.verify.conflicting-evidence-holder`
- `axm.verify.verification-profile-registry`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
