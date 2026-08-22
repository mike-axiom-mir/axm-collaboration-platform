# 028 — Schema Delta Analyzer

**ID:** `axm.adapter.schema-delta-analyzer`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Classify added, removed, renamed, narrowed, widened, reordered, defaulted, and semantically changed fields.

## Working capabilities

- added/removed/renamed classification
- type and enum widening/narrowing
- required/default/annotation changes
- breaking-candidate report

## Honest limitations

- Renames require explicit hints.
- Compatibility is not proven without execution fixtures.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
