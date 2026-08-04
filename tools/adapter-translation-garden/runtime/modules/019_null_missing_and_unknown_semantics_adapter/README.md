# 019 — Null, Missing, and Unknown Semantics Adapter

**ID:** `axm.adapter.null-missing-unknown-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Keep null, absent, defaulted, unknown, unsupported, redacted, and intentionally empty values distinct.

## Working local prototype

- distinct null/missing/unknown states
- target capability adaptation
- sidecar preservation
- blocking-loss collapse report

The implementation is dependency-free Python and defaults to no network access, no native writes, no installation, and no AXM authority.

## Honest limitations

- Meaning beyond the supplied state or hint is not inferred.
- Sidecar preservation requires the caller to retain the sidecar.

## Quick use

Load `implementation.py` directly or use `tools/module_loader.py`. Review the fixtures and run `python run_tests.py` before intake.

## AXM intake

Copy this folder individually together with `shared/axm_translation_core`. Preserve the module ID, source lineage, limitations, and `default_enabled=false`. AXM decides EXTEND, BRIDGE, MERGE, HOLD, or REJECT through its own Merge Gate.
