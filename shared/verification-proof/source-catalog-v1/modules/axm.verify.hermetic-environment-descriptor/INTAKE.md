# Local Intake Card — Hermetic Test Environment Descriptor

- **Module ID:** `axm.verify.hermetic-environment-descriptor`
- **Seed:** 021/100
- **Family:** 3. Deterministic execution and fixtures
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/hermetic_environment_descriptor.py`
- **Primary class:** `HermeticEnvironmentDescriptor`
- **Operation:** `from_mapping`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Describe and compare exact test environments without claiming that a description itself makes execution hermetic.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
