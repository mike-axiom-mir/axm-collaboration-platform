# Local Intake Card — Reference Implementation Oracle

- **Module ID:** `axm.verify.reference-implementation-oracle`
- **Seed:** 015/100
- **Family:** 2. Evidence sufficiency and test oracles
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/reference_implementation_oracle.py`
- **Primary class:** `ReferenceImplementationOracle`
- **Operation:** `evaluate`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Compare candidate observations against named reference observations across explicit cases and comparison profiles.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
