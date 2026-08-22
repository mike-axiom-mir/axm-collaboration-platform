# Local Intake Card — Evidence Summary-to-Source Binder

- **Module ID:** `axm.verify.summary-source-binding`
- **Seed:** 077/100
- **Family:** 8. Evidence integrity, custody, privacy, and portability
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/summary_source_binding.py`
- **Primary class:** `SummarySourceBinding`
- **Operation:** `bind`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Bind compact summary claims to exact supplied source identities, digests, locators, and availability states without treating the summary as authoritative.

## Optional upstream organs

- `axm.verify.artifact-identity-hasher`
- `axm.verify.citation-quote-fidelity-checker`
- `axm.verify.claim-source-trace-binder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
