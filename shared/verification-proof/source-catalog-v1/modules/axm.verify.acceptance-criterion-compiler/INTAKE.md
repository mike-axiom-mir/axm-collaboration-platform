# Local Intake Card — Acceptance Criterion Compiler

- **Module ID:** `axm.verify.acceptance-criterion-compiler`
- **Seed:** 005/100
- **Family:** 1. Claim, requirement, and source truth
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/acceptance_criterion_compiler.py`
- **Primary function:** `compile_acceptance_contract`
- **Operation:** `compile_acceptance_contract`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Compile explicit acceptance criteria without interpreting freeform goals as proof requirements.

## Optional upstream organs

- `axm.verify.typed-claim-registry`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
