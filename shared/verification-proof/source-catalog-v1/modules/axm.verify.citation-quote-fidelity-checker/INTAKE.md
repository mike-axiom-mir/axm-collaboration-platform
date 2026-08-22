# Local Intake Card — Citation and Quote Fidelity Checker

- **Module ID:** `axm.verify.citation-quote-fidelity-checker`
- **Seed:** 009/100
- **Family:** 1. Claim, requirement, and source truth
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/citation_quote_fidelity_checker.py`
- **Primary class:** `CitationQuoteFidelityChecker`
- **Operation:** `evaluate`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Check deterministic citation binding, quote fidelity, attribution, and exact-text support while routing semantic support to human review.

## Optional upstream organs

- `axm.verify.claim-source-trace-binder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
