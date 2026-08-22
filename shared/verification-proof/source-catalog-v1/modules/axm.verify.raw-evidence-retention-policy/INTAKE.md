# Local Intake Card — Raw Evidence Retention Policy

- **Module ID:** `axm.verify.raw-evidence-retention-policy`
- **Seed:** 076/100
- **Family:** 8. Evidence integrity, custody, privacy, and portability
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/raw_evidence_retention_policy.py`
- **Primary class:** `RawEvidenceRetentionPolicy`
- **Operation:** `decide`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Select a declared retention action for supplied evidence metadata and expose authorization, legal-hold, requested-action, and no-match conditions without deleting anything.

## Optional upstream organs

- `axm.verify.evidence-chain-of-custody-ledger`
- `axm.verify.evidence-redaction-privacy-filter`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
