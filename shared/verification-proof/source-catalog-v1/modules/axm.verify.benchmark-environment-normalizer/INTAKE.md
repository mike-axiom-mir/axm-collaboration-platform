# Local Intake Card — Benchmark Environment Normalizer

- **Module ID:** `axm.verify.benchmark-environment-normalizer`
- **Seed:** 084/100
- **Family:** 9. Benchmarking, evaluation, and comparative proof
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/benchmark_environment_normalizer.py`
- **Primary class:** `BenchmarkEnvironmentNormalizer`
- **Operation:** `normalize`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Normalize and fingerprint supplied benchmark hardware, software, load, temperature, cache, network, randomness, and warm-up facts.

## Optional upstream organs

- `axm.verify.build-environment-capture`
- `axm.verify.hermetic-environment-descriptor`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
