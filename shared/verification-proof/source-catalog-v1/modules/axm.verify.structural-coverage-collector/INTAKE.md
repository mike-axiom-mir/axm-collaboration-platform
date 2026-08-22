# Local Intake Card — Structural Coverage Collector

- **Module ID:** `axm.verify.structural-coverage-collector`
- **Seed:** 041/100
- **Family:** 5. Coverage, selection, compatibility, and blind spots
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/structural_coverage_collector.py`
- **Primary class:** `StructuralCoverageCollector`
- **Operation:** `collect`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Collect multiple structural coverage types without collapsing them into correctness.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
