# Local Intake Card — Native Host Round-Trip Proof

- **Module ID:** `axm.verify.native-host-roundtrip-proof`
- **Seed:** 060/100
- **Family:** 6. Visual, interaction, performance, and native proof
- **Version:** 0.1.0
- **Status:** TEST-HOLD / DETACHED / NOT CANON
- **Entrypoint:** `src/native_host_roundtrip_proof.py`
- **Primary class:** `NativeHostRoundtripProof`
- **Operation:** `verify`
- **Reference tests:** 10
- **Side effects:** none

## Purpose

Verify a supplied native host save, reopen, inspect, and optional rollback round trip against exact artifact identities.

## Optional upstream organs

- `axm.verify.artifact-identity-hasher`
- `axm.verify.visual-state-proof-binder`

## Intake boundary

This organ may be reviewed and intake-tested independently. Optional upstream declarations are composition hints only; they do not create runtime coupling, approval authority, release authority, or CANON status.
