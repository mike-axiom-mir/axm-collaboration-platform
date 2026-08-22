# Local Intake Card — Bounded Verification Orchestrator

- **Module ID:** `axm.verify.bounded-verification-orchestrator`
- **Seed:** 100/100
- **Family:** 10. Governance, independent review, release proof, and orchestration
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/bounded_verification_orchestrator.py`
- **Primary class:** `BoundedVerificationOrchestrator`
- **Operation:** `coordinate`
- **Reference tests:** 12
- **Side effects:** none

## Purpose

Coordinate claim routing, supplied verification evidence, conflict holding, human-review requirements, release-gate preparation, and proof-export references without acquiring decision authority.

## Optional upstream organs

- `axm.verify.conflicting-evidence-holder`
- `axm.verify.human-review-receipt`
- `axm.verify.independent-verifier-seat-router`
- `axm.verify.offline-proof-pack-exporter`
- `axm.verify.proof-dependency-graph`
- `axm.verify.release-gate-decision-packet`
- `axm.verify.verification-profile-registry`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
