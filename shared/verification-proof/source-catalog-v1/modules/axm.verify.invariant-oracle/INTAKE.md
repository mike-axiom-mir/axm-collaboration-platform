# Local Intake Card — Invariant Oracle

- **Module ID:** `axm.verify.invariant-oracle`
- **Seed:** 014/100
- **Family:** 2. Evidence sufficiency and test oracles
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/invariant_oracle.py`
- **Primary class:** `InvariantOracle`
- **Operation:** `evaluate`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Evaluate a bounded declarative invariant set over observed JSON-compatible state without executing arbitrary expressions.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
