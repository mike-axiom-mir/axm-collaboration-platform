# Local Intake Card — Release Gate Decision Packet

- **Module ID:** `axm.verify.release-gate-decision-packet`
- **Seed:** 096/100
- **Family:** 10. Governance, independent review, release proof, and orchestration
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/release_gate_decision_packet.py`
- **Primary class:** `ReleaseGateDecisionPacketBuilder`
- **Operation:** `assemble`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Assemble exact artifact identity, required receipts, unresolved conflicts, failures, limitations, approvals, and rollback readiness into a bounded packet for Merge Gate review.

## Optional upstream organs

- `axm.verify.conflicting-evidence-holder`
- `axm.verify.human-review-receipt`
- `axm.verify.proof-dependency-graph`
- `axm.verify.verification-profile-registry`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
