# Local Intake Card — Offline Proof Pack Exporter

- **Module ID:** `axm.verify.offline-proof-pack-exporter`
- **Seed:** 079/100
- **Family:** 8. Evidence integrity, custody, privacy, and portability
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/offline_proof_pack_exporter.py`
- **Primary class:** `OfflineProofPackExporter`
- **Operation:** `export`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Create deterministic portable ZIP bytes containing a manifest and supplied proof files under explicit public or private disclosure rules.

## Optional upstream organs

- `axm.verify.canonical-evidence-serializer`
- `axm.verify.content-addressed-evidence-bundle`
- `axm.verify.evidence-redaction-privacy-filter`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
