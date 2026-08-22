# Local Intake Card — Benchmark Contract Builder

- **Module ID:** `axm.verify.benchmark-contract-builder`
- **Seed:** 081/100
- **Family:** 9. Benchmarking, evaluation, and comparative proof
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/benchmark_contract_builder.py`
- **Primary class:** `BenchmarkContractBuilder`
- **Operation:** `build`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Build a deterministic benchmark contract that limits tasks, metrics, environment, exclusions, stopping rules, and valid conclusions.

## Optional upstream organs

- `axm.verify.hermetic-environment-descriptor`
- `axm.verify.typed-claim-registry`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
