# 087 — Differential Implementation Verifier

**ID:** `axm.adapter.differential-implementation-verifier`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Compare independent readers, writers, engines, validators, or adapter implementations and surface disagreements.

## Working local prototype

- multi-implementation comparison
- structural signatures
- exception comparison
- input mutation detection

The implementation is dependency-free Python and defaults to no network access, no native writes, no installation, and no AXM authority.

## Honest limitations

- Runs supplied callables in the caller process.
- Agreement is not correctness proof.
- Independence of implementations is caller-attested.

## Quick use

Load `implementation.py` directly or use `tools/module_loader.py`. Review the fixtures and run `python run_tests.py` before intake.

## AXM intake

Copy this folder individually together with `shared/axm_translation_core`. Preserve the module ID, source lineage, limitations, and `default_enabled=false`. AXM decides EXTEND, BRIDGE, MERGE, HOLD, or REJECT through its own Merge Gate.
