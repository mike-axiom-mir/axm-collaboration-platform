# Local Intake Card — Redacted Replay Fixture Builder

- **Module ID:** `axm.verify.redacted-replay-fixture-builder`
- **Seed:** 028/100
- **Family:** 3. Deterministic execution and fixtures
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/redacted_replay_fixture_builder.py`
- **Primary class:** `RedactedReplayFixtureBuilder`
- **Operation:** `build`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Transform bounded incident or session events into privacy-reduced replay fixtures through explicit keep, drop, mask, hash, generalize, and relative-time rules.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
