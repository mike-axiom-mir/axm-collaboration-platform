# 030 — Versioned Schema Migration Generator

**ID:** `axm.adapter.versioned-schema-migration-generator`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Generate reversible migration candidates with preconditions, exact diffs, loss reports, and rollback transforms.

## Working capabilities

- deterministic JSON-Schema property migration plans
- explicit rename and default handling
- blocking detection for new required fields without a source or default
- visible removal and type-change risk

## Honest limitations

- Does not execute migrations or mutate data.
- Supports a conservative object-properties subset of JSON Schema.
- Human review remains required for semantic type changes and destructive steps.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
