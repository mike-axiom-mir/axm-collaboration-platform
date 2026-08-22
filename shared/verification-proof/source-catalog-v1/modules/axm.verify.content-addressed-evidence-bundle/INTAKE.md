# Local Intake Card — Content-Addressed Evidence Bundle

- **Module ID:** `axm.verify.content-addressed-evidence-bundle`
- **Seed:** 072/100
- **Family:** 8. Evidence integrity, custody, privacy, and portability
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/content_addressed_evidence_bundle.py`
- **Primary class:** `ContentAddressedEvidenceBundle`
- **Operation:** `bundle`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Package caller-supplied evidence objects under exact SHA-256 identities and a deterministic bounded manifest without writing or publishing an archive.

## Optional upstream organs

- `axm.verify.artifact-identity-hasher`
- `axm.verify.canonical-evidence-serializer`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
