# Local Intake Card — Mutation Testing Scorecard

- **Module ID:** `axm.verify.mutation-testing-scorecard`
- **Seed:** 039/100
- **Family:** 4. Static, dynamic, formal, and generative testing
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/mutation_testing_scorecard.py`
- **Primary class:** `MutationTestingScorecard`
- **Operation:** `score`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Measure whether supplied tests detect controlled mutations without hiding unresolved or potentially equivalent mutants.

## Optional upstream organs

- `axm.verify.test-run-receipt-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
