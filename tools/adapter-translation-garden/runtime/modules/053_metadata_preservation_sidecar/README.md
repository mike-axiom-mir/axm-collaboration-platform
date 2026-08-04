# 053 — Metadata Preservation Sidecar

**ID:** `axm.adapter.metadata-preservation-sidecar`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Store provenance, unsupported metadata, source hashes, color profiles, timing, and extension data beside outputs that cannot carry them.

## Working capabilities

- source-linked metadata sidecars
- integrity and source validation
- conflict-visible sidecar merge

## Honest limitations

- Sidecars may contain private metadata; run module 084 before public export.
- Integrity hash is not an authenticated signature.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
