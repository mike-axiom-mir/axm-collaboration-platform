# Local Intake Card — Build Environment Capture

- **Module ID:** `axm.verify.build-environment-capture`
- **Seed:** 063/100
- **Family:** 7. Provenance, attestations, and reproducible artifacts
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/build_environment_capture.py`
- **Primary class:** `BuildEnvironmentCapture`
- **Operation:** `capture`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Normalize and seal explicit build-environment facts while redacting declared secret variables.

## Optional upstream organs

- `axm.verify.artifact-identity-hasher`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
