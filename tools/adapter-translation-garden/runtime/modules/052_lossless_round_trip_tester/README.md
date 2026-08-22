# 052 — Lossless Round-Trip Tester

**ID:** `axm.adapter.lossless-roundtrip-tester`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Prove whether A→B→A preserves exact bytes, canonical structure, or declared semantics and state which level passed.

## Working capabilities

- A→B→A callable testing
- byte, structure, and semantic levels
- mutation detection
- stage-specific failures

## Honest limitations

- Callables execute in the caller process.
- Passing fixtures does not prove universal round-trip fidelity.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
