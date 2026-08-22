# Stable Handoff Conformance — Atlas v0.6.0

Generated: 2026-08-08T01:21:47+00:00

This report is a status update to the previously issued
`AXM_HUMAN_CAPABILITY_ATLAS_STABLE_HANDOFF_ANCHOR_v0_1_0`.

The original anchor is not rewritten.

## Stable identifiers

- Module: `axm.module.human_capability_atlas`
- Atlas version tested: `0.6.0`
- Shared contract: `axm.capability-interface-contract`
- Supported shared-contract version: exactly `0.1.0`
- Capability Record export format: `0.1.0`

## Fixed from v0.5.0

The old anchor reported six of ten fixture records as failing strict evidence
policy because generated `INFERRED` human names lacked the full stable evidence
tuple.

v0.6.0 now requires every inferred field to include:

- reasoning;
- source basis;
- confidence;
- evidence reference.

All ten shared fixtures pass strict shared-schema + evidence + provenance
conformance in the current test suite.

## Additional hardening

- Duplicate JSON object keys are rejected.
- Raw source SHA-256 is reproduced against accessible source bytes.
- Unverifiable external source locations fail the strict provenance gate.
- Capability Cards receive AXM-CJ-1 canonical hashes.
- Producer receipts prove the real Atlas ran on the identified source/output.
- Receipt is written last and acts as the completion marker.
- Resume reuses only matching verified producer receipts.
- Contract compatibility no longer assumes same-major versions are safe.

## Current shared schema hashes

- `shared_capability.schema.json`: `c63d2c5d4b0ae7aeb8754a5a006a1efd2364c330ad18b74064d74ec7428a71b3`
- `source_capability.schema.json`: `b0e740e64771531633e095581b063927ade7ce6fa7aac8a044065828ff3a9e09`
- `interface_recommendation.schema.json`: `b85e9916f599d2c469b00ea91b12bc3de1e7cd3cceedcd226340fad6dd636e4f`

The shared Capability Record schema itself was not version-bumped by these
Module One hardening changes.

## Honest boundary

This verifies the included fixtures and the Atlas implementation in this
environment. It does not claim that the real local registry or Module Two was
executed.
