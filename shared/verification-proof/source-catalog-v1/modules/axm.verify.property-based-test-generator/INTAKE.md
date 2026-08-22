# Local Intake Card — Property-Based Test Generator

- **Module ID:** `axm.verify.property-based-test-generator`
- **Seed:** 032/100
- **Family:** 4. Static, dynamic, formal, and generative testing
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/property_based_test_generator.py`
- **Primary class:** `PropertyBasedTestGenerator`
- **Operation:** `check`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Generate bounded edge-oriented examples and shrink the first property counterexample.

## Optional upstream organs

- `axm.verify.minimal-reproducer-extractor`
- `axm.verify.seeded-randomness-controller`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
