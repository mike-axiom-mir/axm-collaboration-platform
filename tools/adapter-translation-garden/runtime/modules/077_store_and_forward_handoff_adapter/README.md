# 077 — Store-and-Forward Handoff Adapter

**ID:** `axm.adapter.store-forward-handoff-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Move signed, content-addressed work packets between disconnected devices using files, QR, removable storage, or temporary LAN.

## Working capabilities

- in-memory chunked handoff packages
- per-chunk and full-payload SHA-256 integrity
- package verification and receipt generation
- store-and-forward planning without I/O

## Honest limitations

- Does not write files, send data, or manage removable media.
- Does not encrypt packages.
- Authenticity requires signatures from a separate module.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
