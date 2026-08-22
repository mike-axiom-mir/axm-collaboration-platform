# Local Intake Card — Long-Term Proof and Schema Migrator

- **Module ID:** `axm.verify.long-term-proof-migrator`
- **Seed:** 080/100
- **Family:** 8. Evidence integrity, custody, privacy, and portability
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/long_term_proof_migrator.py`
- **Primary class:** `LongTermProofMigrator`
- **Operation:** `migrate`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Bind supplied original and migrated proof bytes to a checked schema-migration lineage while preserving both byte streams.

## Optional upstream organs

- `axm.verify.canonical-evidence-serializer`
- `axm.verify.tamper-seal-reverification`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
