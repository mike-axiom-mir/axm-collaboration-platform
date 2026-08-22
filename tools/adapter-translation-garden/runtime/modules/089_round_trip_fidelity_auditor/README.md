# 089 — Round-Trip Fidelity Auditor

**ID:** `axm.adapter.roundtrip-fidelity-auditor`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Measure byte, structure, meaning, appearance, timing, behavior, and authority fidelity as separate claims.

## Working local prototype

- separate fidelity dimensions
- byte and structure comparison
- timing tolerance
- authority-loss refusal
- UNPROVEN preservation

The implementation is dependency-free Python and defaults to no network access, no native writes, no installation, and no AXM authority.

## Honest limitations

- Meaning, appearance, behavior, and authority require explicit evidence values.
- Hash equality only supports the supplied claim and is not perceptual proof.

## Quick use

Load `implementation.py` directly or use `tools/module_loader.py`. Review the fixtures and run `python run_tests.py` before intake.

## AXM intake

Copy this folder individually together with `shared/axm_translation_core`. Preserve the module ID, source lineage, limitations, and `default_enabled=false`. AXM decides EXTEND, BRIDGE, MERGE, HOLD, or REJECT through its own Merge Gate.
