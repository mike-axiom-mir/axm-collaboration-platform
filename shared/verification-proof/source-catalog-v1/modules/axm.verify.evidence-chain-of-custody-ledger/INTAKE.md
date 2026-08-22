# Local Intake Card — Evidence Chain-of-Custody Ledger

- **Module ID:** `axm.verify.evidence-chain-of-custody-ledger`
- **Seed:** 073/100
- **Family:** 8. Evidence integrity, custody, privacy, and portability
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/evidence_chain_of_custody_ledger.py`
- **Primary class:** `EvidenceChainOfCustodyLedger`
- **Operation:** `append`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Create and verify an append-only hash-linked ledger of evidence custody events while preserving actor, action, time, object, details, and claimed authority scope.

## Optional upstream organs

- `axm.verify.artifact-identity-hasher`
- `axm.verify.canonical-evidence-serializer`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
