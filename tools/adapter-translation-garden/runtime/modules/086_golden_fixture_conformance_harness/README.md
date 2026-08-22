# 086 — Golden Fixture Conformance Harness

**ID:** `axm.adapter.golden-fixture-conformance-harness`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Test adapters against reviewed valid, invalid, edge, legacy, and adversarial fixtures.

## Working local prototype

- reviewed fixture execution
- valid/invalid/edge/legacy/adversarial labels
- exception expectations
- input mutation detection

The implementation is dependency-free Python and defaults to no network access, no native writes, no installation, and no AXM authority.

## Honest limitations

- Runs supplied callables in the caller process.
- Not a security sandbox and provides no timeout or memory limit.

## Quick use

Load `implementation.py` directly or use `tools/module_loader.py`. Review the fixtures and run `python run_tests.py` before intake.

## AXM intake

Copy this folder individually together with `shared/axm_translation_core`. Preserve the module ID, source lineage, limitations, and `default_enabled=false`. AXM decides EXTEND, BRIDGE, MERGE, HOLD, or REJECT through its own Merge Gate.
