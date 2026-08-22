# Local Intake Card — Exact Dependency Lock Verifier

- **Module ID:** `axm.verify.dependency-lock-verifier`
- **Seed:** 022/100
- **Family:** 3. Deterministic execution and fixtures
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/dependency_lock_verifier.py`
- **Primary class:** `DependencyLockVerifier`
- **Operation:** `verify`
- **Reference tests:** 10
- **Side effects:** none outside caller-owned in-memory state

## Purpose

Compare resolved dependency identity, version, source, digest, and transitive relationships against an explicitly reviewed lock.

## Optional upstream organs

- None declared.

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
