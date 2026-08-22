# Local Intake Card — Evidence Redaction and Privacy Filter

- **Module ID:** `axm.verify.evidence-redaction-privacy-filter`
- **Seed:** 075/100
- **Family:** 8. Evidence integrity, custody, privacy, and portability
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/evidence_redaction_privacy_filter.py`
- **Primary class:** `EvidenceRedactionPrivacyFilter`
- **Operation:** `filter`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Apply an explicit path policy to JSON-compatible evidence using keep, drop, mask, hash, or generalize actions under a safe default.

## Optional upstream organs

- `axm.verify.canonical-evidence-serializer`
- `axm.verify.redacted-replay-fixture-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
