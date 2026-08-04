# 071 — Transport Abstraction Adapter

**ID:** `axm.adapter.transport-abstraction-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Keep domain messages stable while switching among in-process, file, HTTP, WebSocket, local socket, serial, or message-bus transports.

## Working capabilities

- transport capability normalization
- required-feature and size-limit matching
- locality, reliability, bandwidth, and power-aware ranking
- connection-free transport selection

## Honest limitations

- Does not open, discover, or configure transports.
- Candidate metrics are caller-declared and not measured.
- Security properties must be independently verified.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
