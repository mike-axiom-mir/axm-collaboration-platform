# Local Intake Card — Dataset and Fixture Provenance Verifier

- **Module ID:** `axm.verify.dataset-fixture-provenance`
- **Seed:** 082/100
- **Family:** 9. Benchmarking, evaluation, and comparative proof
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/dataset_fixture_provenance.py`
- **Primary class:** `DatasetFixtureProvenanceVerifier`
- **Operation:** `verify`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Check supplied dataset identity, origin, transformations, permissions, splits, checksums, representativeness declarations, and limitations.

## Optional upstream organs

- `axm.verify.artifact-identity-hasher`
- `axm.verify.source-artifact-provenance-builder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
