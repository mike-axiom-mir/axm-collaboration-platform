# Local Intake Card — Benchmark Leakage and Contamination Detector

- **Module ID:** `axm.verify.leakage-contamination-detector`
- **Seed:** 087/100
- **Family:** 9. Benchmarking, evaluation, and comparative proof
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/leakage_contamination_detector.py`
- **Primary class:** `LeakageContaminationDetector`
- **Operation:** `detect`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Detect exact identifiers, byte duplicates, normalized text reuse, declared or patterned hints, and exact output/evaluation overlap on supplied benchmark materials.

## Optional upstream organs

- `axm.verify.artifact-identity-hasher`
- `axm.verify.dataset-fixture-provenance`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
