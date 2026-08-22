# 016 — Temporal Semantics Translator

**ID:** `axm.adapter.temporal-semantics-translator`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Translate timestamps, durations, time zones, monotonic clocks, frame counts, sample times, validity windows, and recurring schedules.

## Working local prototype

- timezone-aware timestamp translation
- duration conversion
- frame and sample time conversion
- validity windows
- bounded recurrence descriptors

The implementation is dependency-free Python and defaults to no network access, no native writes, no installation, and no AXM authority.

## Honest limitations

- No leap-second handling.
- Recurrence descriptors are normalized but not expanded.
- Naive timestamps require an explicit timezone assumption.

## Quick use

Load `implementation.py` directly or use `tools/module_loader.py`. Review the fixtures and run `python run_tests.py` before intake.

## AXM intake

Copy this folder individually together with `shared/axm_translation_core`. Preserve the module ID, source lineage, limitations, and `default_enabled=false`. AXM decides EXTEND, BRIDGE, MERGE, HOLD, or REJECT through its own Merge Gate.
