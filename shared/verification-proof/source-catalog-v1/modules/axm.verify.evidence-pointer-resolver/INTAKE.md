# Local Intake Card — Evidence Pointer Resolver

- **Module ID:** `axm.verify.evidence-pointer-resolver`
- **Seed:** 078/100
- **Family:** 8. Evidence integrity, custody, privacy, and portability
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/evidence_pointer_resolver.py`
- **Primary class:** `EvidencePointerResolver`
- **Operation:** `resolve`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Resolve typed evidence pointers only against an explicit offline catalog and report resolved, stale, or broken state without network or filesystem traversal.

## Optional upstream organs

- `axm.verify.content-addressed-evidence-bundle`
- `axm.verify.summary-source-binding`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
