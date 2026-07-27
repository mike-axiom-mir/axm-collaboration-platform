---
name: taint-sniffer
sense: chemoreception
status: ACCEPT_FOR_TEST
pack: axm-sensorium/1.4.0
capability: sense.integrity.taint/v1
---

# Taint Sniffer - incoming material

Inspect one bounded incoming handoff for concrete integrity and injection-shaped warning signals without declaring guilt or taking action.

## Inputs

- materialId
- mediaType
- material
- expectedSha256
- observedAt

## Procedure

1. Require one exact material identity and one caller-supplied bounded string or byte array.
2. Compute SHA-256 and compare an optional expected digest.
3. For declared text, inspect deterministic encoding, control-character, binary-signature, injection-shaped, credential-shaped, and declared-JSON signals.
4. Return NO_TAINT_SIGNAL, TAINT_SIGNALLED, or UNKNOWN with named signals and no raw excerpt.
5. Route warnings to review, release the sample, and take no direct action.

## Boundaries

- No path or URL fetching and no material execution.
- No malware verdict, reputation lookup, signer validation, or semantic intent judgment.
- No automatic trust, block, quarantine, deletion, promotion, or permission change.
- A warning is not proof of guilt; no warning is not proof of safety.
- Raw material and matched excerpts never enter the retained receipt.

## Release before the next step

**Ephemeral by default.** EPHEMERAL BY DEFAULT. Raw sense material is released at the next step. Only a bounded typed receipt survives.

- Raw material: sense-specific bounded input
- Release boundary: before the typed observation is returned
- Survives: specific receipt plus axm.sensorium-receipt/v1 envelope
- Raw retained after step: zero
- Accumulation across uses: flat and zero after every release boundary
- Receipt cap: newest 20 per sense
- Deletion scope: only material created by the exact sense use, by exact id or path; never a wildcard or recursive sweep

## Runtime contract

- Route: `EXECUTABLE`
- Module: `taint-sniffer.js`
- Specific receipt: `axm.taint-sniffer-record/v1`
- Common envelope: `axm.sensorium-receipt/v1`
- Authority inherited: `false`
- Promotion gate: `Mike`

## Current separate statuses

- Skill: `ACCEPT_FOR_TEST`
- Executor: `EXECUTABLE`
- Adapter: `NOT_REQUIRED`
- Proof: `RUNTIME_PASS`
- Authority: `NO_LEASE`
