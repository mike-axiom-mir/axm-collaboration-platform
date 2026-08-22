# Local Intake Card — Bounded Fault-Injection Runner

- **Module ID:** `axm.verify.bounded-fault-injection-runner`
- **Seed:** 040/100
- **Family:** 4. Static, dynamic, formal, and generative testing
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/bounded_fault_injection_runner.py`
- **Primary class:** `BoundedFaultInjectionRunner`
- **Operation:** `run`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Execute bounded declarative fault cases through a caller-supplied executor while preserving recovery and uncertainty.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
