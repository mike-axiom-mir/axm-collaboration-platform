# 014 — Enum and Codebook Crosswalk

**ID:** `axm.adapter.enum-codebook-crosswalk`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Map enums, status codes, category systems, taxonomies, and legacy codebooks while preserving unmapped values.

## Working local prototype

- enum and codebook crosswalk
- unmapped preservation
- ambiguous target refusal

The implementation is dependency-free Python and defaults to no network access, no native writes, no installation, and no AXM authority.

## Honest limitations

- Explicit crosswalk entries only.
- No taxonomy inference or synonym guessing.

## Quick use

Load `implementation.py` directly or use `tools/module_loader.py`. Review the fixtures and run `python run_tests.py` before intake.

## AXM intake

Copy this folder individually together with `shared/axm_translation_core`. Preserve the module ID, source lineage, limitations, and `default_enabled=false`. AXM decides EXTEND, BRIDGE, MERGE, HOLD, or REJECT through its own Merge Gate.
