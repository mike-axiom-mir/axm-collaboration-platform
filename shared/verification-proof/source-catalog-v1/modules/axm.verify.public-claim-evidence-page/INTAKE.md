# Local Intake Card — Public Claim Evidence Page Generator

- **Module ID:** `axm.verify.public-claim-evidence-page`
- **Seed:** 099/100
- **Family:** 10. Governance, independent review, release proof, and orchestration
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/public_claim_evidence_page.py`
- **Primary class:** `PublicClaimEvidencePageGenerator`
- **Operation:** `generate`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Produce a readable public claim-to-proof page that keeps passed, failed, unknown, stale, limitations, source references, withheld private evidence, and reproducible steps visibly separate.

## Optional upstream organs

- `axm.verify.claim-source-trace-binder`
- `axm.verify.evidence-redaction-privacy-filter`
- `axm.verify.multi-objective-scorecard`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
