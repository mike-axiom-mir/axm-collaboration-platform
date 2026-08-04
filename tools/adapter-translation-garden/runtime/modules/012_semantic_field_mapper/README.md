# 012 — Semantic Field Mapper

**ID:** `axm.adapter.semantic-field-mapper`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Map fields by meaning rather than name alone and preserve unresolved or disputed mappings.

## Working local prototype

- explicit semantic field mapping
- dispute preservation
- unmapped source sidecar
- visible loss ledger

The implementation is dependency-free Python and defaults to no network access, no native writes, no installation, and no AXM authority.

## Honest limitations

- Explicit dot-path object mapping only; no list-index path language.
- No fuzzy or embedding-based inference.
- Caller must confirm semantic rules.

## Quick use

Load `implementation.py` directly or use `tools/module_loader.py`. Review the fixtures and run `python run_tests.py` before intake.

## AXM intake

Copy this folder individually together with `shared/axm_translation_core`. Preserve the module ID, source lineage, limitations, and `default_enabled=false`. AXM decides EXTEND, BRIDGE, MERGE, HOLD, or REJECT through its own Merge Gate.
