# 038 — WebSocket and Event-Stream Bridge

**ID:** `axm.adapter.websocket-eventstream-bridge`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Translate persistent bidirectional or server-push streams into ordered local events with reconnection and resume semantics.

## Working capabilities

- WebSocket-like frame to event-stream envelope mapping
- text and binary payload preservation
- sequence and event-name preservation
- control-frame refusal outside the data bridge

## Honest limitations

- Does not open sockets or stream data.
- Compression extensions are not implemented.
- Fragment reassembly must happen before this bridge.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
