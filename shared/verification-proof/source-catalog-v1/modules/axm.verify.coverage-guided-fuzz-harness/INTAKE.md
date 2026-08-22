# Local Intake Card — Coverage-Guided Fuzz Harness

- **Module ID:** `axm.verify.coverage-guided-fuzz-harness`
- **Seed:** 036/100
- **Family:** 4. Static, dynamic, formal, and generative testing
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/coverage_guided_fuzz_harness.py`
- **Primary class:** `CoverageGuidedFuzzHarness`
- **Operation:** `run`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Perform bounded deterministic coverage-guided byte mutation and retain a first failure reproducer.

## Optional upstream organs

- `axm.verify.minimal-reproducer-extractor`
- `axm.verify.seeded-randomness-controller`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
