# Local Intake Card — Transparency Log Inclusion Proof

- **Module ID:** `axm.verify.transparency-log-inclusion-proof`
- **Seed:** 069/100
- **Family:** 7. Provenance, attestations, and reproducible artifacts
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/transparency_log_inclusion_proof.py`
- **Primary class:** `TransparencyLogInclusionProof`
- **Operation:** `verify`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Recompute a domain-separated Merkle inclusion root from an entry and explicit sibling path, then compare it with a supplied signed-root receipt.

## Optional upstream organs

- `axm.verify.artifact-identity-hasher`
- `axm.verify.signature-keyless-verifier`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
