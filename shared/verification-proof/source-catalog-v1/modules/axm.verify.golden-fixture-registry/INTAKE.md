# Local Intake Card — Golden Fixture Registry

- **Module ID:** `axm.verify.golden-fixture-registry`
- **Seed:** 026/100
- **Family:** 3. Deterministic execution and fixtures
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/golden_fixture_registry.py`
- **Primary class:** `GoldenFixtureRegistry`
- **Operation:** `register`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Register immutable reviewed fixtures with category, exact digest, provenance, expected claims, reviewer, and review receipt.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
