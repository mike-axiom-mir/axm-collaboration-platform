# Local Intake Card — Minimal Reproducer Extractor

- **Module ID:** `axm.verify.minimal-reproducer-extractor`
- **Seed:** 029/100
- **Family:** 3. Deterministic execution and fixtures
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/minimal_reproducer_extractor.py`
- **Primary class:** `MinimalReproducerExtractor`
- **Operation:** `shrink_sequence`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Shrink failing sequences, mappings, or bytes under a bounded predicate budget while preserving the failure and reporting only tested one-minimality.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
