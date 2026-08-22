# Local Intake Card — Requirement Traceability Graph

- **Module ID:** `axm.verify.requirement-traceability-graph`
- **Seed:** 007/100
- **Family:** 1. Claim, requirement, and source truth
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/requirement_traceability_graph.py`
- **Primary class:** `RequirementTraceabilityGraph`
- **Operation:** `add_node`
- **Reference tests:** 11
- **Side effects:** optional append-only local JSONL at a caller-supplied path

## Purpose

Maintain append-only trace links across goals, requirements, implementation, tests, evidence, failures, and decisions.

## Optional upstream organs

- `axm.verify.acceptance-criterion-compiler`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
