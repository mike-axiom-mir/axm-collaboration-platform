# 029 — Backward and Forward Compatibility Matrix Tester

**ID:** `axm.adapter.compatibility-matrix-tester`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Execute reader/writer and producer/consumer combinations to prove which version pairs actually interoperate.

## Working capabilities

- producer/consumer version matrix
- backward/forward relation labels
- fixture-level exceptions
- input mutation detection

## Honest limitations

- Callables execute in the caller process.
- Results prove only supplied fixtures, not universal compatibility.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
