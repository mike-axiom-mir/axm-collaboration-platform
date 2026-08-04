# 015 — Identity and ID Crosswalk

**ID:** `axm.adapter.identity-id-crosswalk`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Relate identifiers across systems without assuming equal authority, uniqueness scope, lifetime, or privacy level.

## Working local prototype

- scoped identity crosswalk
- validity filtering
- privacy redaction
- ambiguity preservation

The implementation is dependency-free Python and defaults to no network access, no native writes, no installation, and no AXM authority.

## Honest limitations

- Resolves only supplied records.
- Does not prove real-world identity or ownership.
- Time filtering occurs only when at_time is explicitly supplied.

## Quick use

Load `implementation.py` directly or use `tools/module_loader.py`. Review the fixtures and run `python run_tests.py` before intake.

## AXM intake

Copy this folder individually together with `shared/axm_translation_core`. Preserve the module ID, source lineage, limitations, and `default_enabled=false`. AXM decides EXTEND, BRIDGE, MERGE, HOLD, or REJECT through its own Merge Gate.
