# Local Intake Card — Source-to-Artifact Provenance Builder

- **Module ID:** `axm.verify.source-artifact-provenance-builder`
- **Seed:** 062/100
- **Family:** 7. Provenance, attestations, and reproducible artifacts
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/source_artifact_provenance_builder.py`
- **Primary class:** `SourceArtifactProvenanceBuilder`
- **Operation:** `build`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Build a deterministic source-to-artifact provenance statement from explicit subjects, materials, builder, configuration, environment, and activity.

## Optional upstream organs

- `axm.verify.artifact-identity-hasher`
- `axm.verify.build-environment-capture`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
