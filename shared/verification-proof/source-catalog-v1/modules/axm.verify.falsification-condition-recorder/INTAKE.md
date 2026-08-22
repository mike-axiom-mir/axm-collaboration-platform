# Local Intake Card — Falsification and Counterevidence Recorder

- **Module ID:** `axm.verify.falsification-condition-recorder`
- **Seed:** 006/100
- **Family:** 1. Claim, requirement, and source truth
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/falsification_condition_recorder.py`
- **Primary class:** `FalsificationConditionRecorder`
- **Operation:** `record`
- **Reference tests:** 9
- **Side effects:** optional append-only local JSONL at a caller-supplied path

## Purpose

Record predeclared falsification and weakening observations before testing begins.

## Optional upstream organs

- `axm.verify.acceptance-criterion-compiler`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
