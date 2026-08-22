# Local Intake Card — Canonical Evidence Serializer

- **Module ID:** `axm.verify.canonical-evidence-serializer`
- **Seed:** 071/100
- **Family:** 8. Evidence integrity, custody, privacy, and portability
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/canonical_evidence_serializer.py`
- **Primary class:** `CanonicalEvidenceSerializer`
- **Operation:** `serialize`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Normalize a bounded JSON-compatible evidence value and serialize it deterministically so its digest can be recomputed across handoff and restoration.

## Optional upstream organs

- `axm.verify.artifact-identity-hasher`
- `axm.verify.test-run-receipt-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
