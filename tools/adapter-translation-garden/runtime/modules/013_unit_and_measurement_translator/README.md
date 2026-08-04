# 013 — Unit and Measurement Translator

**ID:** `axm.adapter.unit-measurement-translator`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Translate units, scales, precision, coordinate conventions, and tolerances with explicit rounding and loss reports.

## Working local prototype

- length, mass, duration, angle, and temperature conversion
- explicit precision and rounding
- tolerance report
- visible conversion loss

The implementation is dependency-free Python and defaults to no network access, no native writes, no installation, and no AXM authority.

## Honest limitations

- Reviewed built-in unit registry only.
- No currencies, compound dimensions, DPI inference, or uncertainty propagation.
- Temperature conversion uses decimal constants.

## Quick use

Load `implementation.py` directly or use `tools/module_loader.py`. Review the fixtures and run `python run_tests.py` before intake.

## AXM intake

Copy this folder individually together with `shared/axm_translation_core`. Preserve the module ID, source lineage, limitations, and `default_enabled=false`. AXM decides EXTEND, BRIDGE, MERGE, HOLD, or REJECT through its own Merge Gate.
