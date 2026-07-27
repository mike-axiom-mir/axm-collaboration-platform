---
name: ears-stream-listener
sense: hearing
status: ACCEPT_FOR_TEST
pack: axm-sensorium/1.4.0
capability: sense.hearing.bounded-stream/v1
---

# Ears - bounded stream

Read one bounded event window, treat silence as data, and release the stream buffer.

## Inputs

- claim
- source
- expectedEvents
- refutingEvents
- windowMs

## Procedure

1. Open one named bounded stream window.
2. Prefer refuting evidence.
3. Record silence and eviction.
4. Seal matched typed events and digest.
5. Release the buffer.

## Boundaries

- Does not alter the source log.
- Does not keep a transcript.
- Does not listen beyond the declared window.

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
- Module: `ears-stream-listener.js`
- Specific receipt: `axm.ears-listen-digest/v1`
- Common envelope: `axm.sensorium-receipt/v1`
- Authority inherited: `false`
- Promotion gate: `Mike`

## Current separate statuses

- Skill: `ACCEPT_FOR_TEST`
- Executor: `EXECUTABLE`
- Adapter: `AVAILABLE`
- Proof: `RUNTIME_PASS`
- Authority: `NO_LEASE`
