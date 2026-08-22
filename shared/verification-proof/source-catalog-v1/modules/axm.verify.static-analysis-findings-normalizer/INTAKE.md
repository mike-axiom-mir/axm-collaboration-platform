# Local Intake Card — Static Analysis Findings Normalizer

- **Module ID:** `axm.verify.static-analysis-findings-normalizer`
- **Seed:** 038/100
- **Family:** 4. Static, dynamic, formal, and generative testing
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/static_analysis_findings_normalizer.py`
- **Primary class:** `StaticAnalysisFindingsNormalizer`
- **Operation:** `normalize`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Combine static-analysis diagnostics into typed non-duplicated evidence without collapsing suppressions or tool identities.

## Optional upstream organs

- `axm.verify.test-run-receipt-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
