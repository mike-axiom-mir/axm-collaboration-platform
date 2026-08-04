# 088 — Malformed-Input and Fuzz Harness

**ID:** `axm.adapter.malformed-input-fuzz-harness`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Exercise parsers and translators with truncated, oversized, recursive, duplicate, hostile, and boundary inputs inside a sandbox.

## Working local prototype

- deterministic malformed-input corpus
- size and depth limits
- raw duplicate-key fixture
- external outcome classification

The implementation is dependency-free Python and defaults to no network access, no native writes, no installation, and no AXM authority.

## Honest limitations

- Generates bounded cases but deliberately does not execute a target.
- A separate process sandbox is required for hostile execution.

## Quick use

Load `implementation.py` directly or use `tools/module_loader.py`. Review the fixtures and run `python run_tests.py` before intake.

## AXM intake

Copy this folder individually together with `shared/axm_translation_core`. Preserve the module ID, source lineage, limitations, and `default_enabled=false`. AXM decides EXTEND, BRIDGE, MERGE, HOLD, or REJECT through its own Merge Gate.
