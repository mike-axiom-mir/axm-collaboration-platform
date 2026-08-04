# 096 — Deterministic Conversion Cache

**ID:** `axm.adapter.deterministic-conversion-cache`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.6.0`

## Purpose

Reuse content-addressed outputs only when source, contract, adapter, options, environment, and proof hashes match.

## Working capabilities

- deterministic cache-key generation from source, contract, adapter, options, environment, and proof hashes
- exact cache-entry match and mismatch diagnostics
- immutable in-memory put and quarantine plans
- proof and environment participation in cache identity

## Honest limitations

- Does not write cache files, evict storage, or trust outputs automatically.
- Caller must supply canonical hashes from separate proof modules.
- Cache hits are reusable only under the exact declared identity tuple.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
