# 051 — Binary Format Probe

**ID:** `axm.adapter.binary-format-probe`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Inspect magic bytes, container structure, compression, checksums, and declared type without decoding executable content.

## Working capabilities

- magic-byte identification
- declared-type mismatch warnings
- SHA-256 and probe entropy
- executable-like flag without execution

## Honest limitations

- Does not extract, decompress, parse, or execute content.
- Magic registry is deliberately finite.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
