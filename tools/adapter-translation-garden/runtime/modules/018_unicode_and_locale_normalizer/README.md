# 018 — Unicode and Locale Normalizer

**ID:** `axm.adapter.unicode-locale-normalizer`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Normalize text, identifiers, locale conventions, decimal separators, collation, and encoding while preventing silent semantic collapse.

## Working local prototype

- Unicode normalization
- explicit casefold and trim
- localized decimal parsing
- identifier normalization with visible loss

The implementation is dependency-free Python and defaults to no network access, no native writes, no installation, and no AXM authority.

## Honest limitations

- Locale separators must be explicitly supplied.
- No locale database or collation engine.
- Aggressive normalization reports collision risk but cannot detect every collision.

## Quick use

Load `implementation.py` directly or use `tools/module_loader.py`. Review the fixtures and run `python run_tests.py` before intake.

## AXM intake

Copy this folder individually together with `shared/axm_translation_core`. Preserve the module ID, source lineage, limitations, and `default_enabled=false`. AXM decides EXTEND, BRIDGE, MERGE, HOLD, or REJECT through its own Merge Gate.
