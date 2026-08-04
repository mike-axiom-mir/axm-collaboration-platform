# 032 — RPC-to-Message Bridge

**ID:** `axm.adapter.rpc-message-bridge`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Translate request/response RPC into correlated messages with deadlines, idempotency keys, cancellation, and explicit delivery assumptions.

## Working capabilities

- RPC request and response message envelopes
- correlation and method preservation
- explicit error payload separation
- deterministic local envelope generation

## Honest limitations

- Does not send messages or invoke RPC handlers.
- Streaming RPC is not implemented.
- Schema validation must be supplied by adjacent modules.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
