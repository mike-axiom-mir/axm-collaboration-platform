# 036 — Asynchronous-to-Synchronous Response Broker

**ID:** `axm.adapter.async-sync-response-broker`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Provide bounded waiting and honest pending responses when a synchronous caller depends on asynchronous work.

## Working capabilities

- correlation-scoped asynchronous response collection
- complete, pending, error, and ambiguous outcome classification
- duplicate terminal-response detection
- timeout visibility without waiting

## Honest limitations

- Does not wait, poll, subscribe, or block a thread.
- Does not transport responses.
- Caller supplies the already-received message set.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
