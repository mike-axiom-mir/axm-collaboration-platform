# Local Intake Card — Requirement Coverage Mapper

- **Module ID:** `axm.verify.requirement-coverage-mapper`
- **Seed:** 043/100
- **Family:** 5. Coverage, selection, compatibility, and blind spots
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/requirement_coverage_mapper.py`
- **Primary class:** `RequirementCoverageMapper`
- **Operation:** `map`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Show requirement evidence coverage by proof category without hiding missing or uncertain evidence.

## Optional upstream organs

- `axm.verify.requirement-traceability-graph`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
