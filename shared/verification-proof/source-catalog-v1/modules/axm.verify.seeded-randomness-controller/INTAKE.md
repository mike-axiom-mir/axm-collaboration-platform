# Local Intake Card — Seeded Randomness Controller

- **Module ID:** `axm.verify.seeded-randomness-controller`
- **Seed:** 023/100
- **Family:** 3. Deterministic execution and fixtures
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/seeded_randomness_controller.py`
- **Primary class:** `SeededRandomnessController`
- **Operation:** `receipt`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Provide isolated replayable pseudo-random operations with exact seed, generator identity, transcript, state digest, and declared nondeterministic exceptions.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
