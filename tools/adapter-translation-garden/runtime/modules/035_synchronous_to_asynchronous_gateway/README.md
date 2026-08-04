# 035 — Synchronous-to-Asynchronous Gateway

**ID:** `axm.adapter.sync-async-gateway`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Convert immediate calls into queued work with receipts, polling, cancellation, timeout, and eventual result states.

## Working capabilities

- deterministic sync-call to job-envelope conversion
- explicit job-state transition validation
- terminal-state protection
- no-execution asynchronous planning

## Honest limitations

- Does not schedule or execute jobs.
- Does not persist state.
- Retry policy is descriptive only.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
