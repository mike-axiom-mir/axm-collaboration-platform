# Local Intake Card — Conflicting Evidence Holder

- **Module ID:** `axm.verify.conflicting-evidence-holder`
- **Seed:** 012/100
- **Family:** 2. Evidence sufficiency and test oracles
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/conflicting_evidence_holder.py`
- **Primary class:** `ConflictingEvidenceHolder`
- **Operation:** `add_receipt`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Hold contradictory valid receipts by exact claim profile and scope without averaging, deleting, or automatically resolving them.

## Optional upstream organs

- `axm.verify.evidence-sufficiency-policy`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
