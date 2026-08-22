# 027 — Tabular Schema Inferencer

**ID:** `axm.adapter.tabular-schema-inferencer`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Infer candidate schemas for CSV and spreadsheet-like data while exposing confidence, locale assumptions, malformed rows, and type conflicts.

## Working capabilities

- CSV and object-row candidate inference
- type conflicts and confidence
- malformed-row reporting
- formula non-execution

## Honest limitations

- Inference is candidate evidence, not a source contract.
- Locale and delimiter settings must be explicit.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
