# 063 — Case-Sensitivity Bridge

**ID:** `axm.adapter.case-sensitivity-bridge`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.2.0`

## Purpose

Detect and resolve filename or identifier collisions between case-sensitive and case-insensitive systems.

## Working capabilities

- casefold collision analysis
- refusal-first resolution
- deterministic suffix policies
- source mapping preservation

## Honest limitations

- Suffixes change names and require sidecar retention.
- Filesystem normalization differences beyond Unicode form are not simulated.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
