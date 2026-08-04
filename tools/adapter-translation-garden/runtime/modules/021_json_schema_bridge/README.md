# 021 — JSON Schema Bridge

**ID:** `axm.adapter.json-schema-bridge`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Translate and bundle JSON Schema dialects while preserving vocabulary support, references, annotations, and unsupported constraints.

## Working capabilities

- conservative JSON Schema dialect mapping
- unsupported keyword sidecars
- local registry bundles
- no remote reference fetching

## Honest limitations

- Not a complete JSON Schema implementation or validator.
- Unsupported constraints produce blocking visible loss.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
