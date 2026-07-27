---
name: handoff-continuity-steward
sense: memory-across-time
status: ACCEPT_FOR_TEST
pack: axm-sensorium/1.4.0
capability: sense.continuity.handoff/v1
---

# Continuity - handoff

Carry typed facts, holds, and next steps across processes while re-reading access.

## Inputs

- workLine
- turnId
- seat
- verifiedFacts
- assumedFacts
- openHolds
- decisions
- nextStep

## Procedure

1. Write one typed record at turn end.
2. Separate verified and assumed facts.
3. Append exact holds and next step.
4. Read in a fresh process.
5. Re-read access instead of inheriting it.

## Boundaries

- Continuity is not authority.
- No prior record rewrite.
- No raw sensory payload.

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
- Module: `handoff-continuity-steward.js`
- Specific receipt: `axm.handoff-record/v1`
- Common envelope: `axm.sensorium-receipt/v1`
- Authority inherited: `false`
- Promotion gate: `Mike`

## Current separate statuses

- Skill: `ACCEPT_FOR_TEST`
- Executor: `EXECUTABLE`
- Adapter: `AVAILABLE`
- Proof: `RUNTIME_PASS`
- Authority: `NO_LEASE`
