# 076 — Offline Queue and Replay Adapter

**ID:** `axm.adapter.offline-queue-replay-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Queue intent and evidence locally, preserve ordering and idempotency, and replay only when the destination and permission are valid.

## Working capabilities

- deterministic in-memory queue envelopes
- idempotency-key duplicate detection
- sequence-ordered replay planning
- acknowledgement planning without deletion or transport

## Honest limitations

- Does not persist or transmit queue items.
- Caller supplies timestamps and identifiers for deterministic operation.
- Conflict resolution remains explicit and external.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
