---
name: compaction-steward
sense: tidy-forgetting
status: ACCEPT_FOR_TEST
pack: axm-sensorium/1.4.0
capability: sense.provenance.compaction/v1
---

# Compaction - provenance

Archive verified cold provenance with hash and retrieval proof, leaving a hot digest.

## Inputs

- items
- boundaryRule
- confirmation

## Procedure

1. Preview exact hot and archive paths.
2. Read the owned source.
3. Write and read back archive.
4. Compare digest before hot replacement.
5. Leave a retrievable hot digest.

## Boundaries

- No deletion of provenance.
- No uncertain ownership.
- No raw sensory buffers.

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
- Module: `compaction-steward.js`
- Specific receipt: `axm.compaction-record/v1`
- Common envelope: `axm.sensorium-receipt/v1`
- Authority inherited: `false`
- Promotion gate: `Mike`

## Current separate statuses

- Skill: `ACCEPT_FOR_TEST`
- Executor: `EXECUTABLE`
- Adapter: `AVAILABLE`
- Proof: `RUNTIME_PASS`
- Authority: `NO_LEASE`
