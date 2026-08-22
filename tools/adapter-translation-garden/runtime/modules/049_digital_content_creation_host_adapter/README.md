# 049 — Digital Content Creation Host Adapter

**ID:** `axm.adapter.dcc-host-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.5.0`

## Purpose

Apply approved recipes to Blender or another installed creative host through fixed entrypoints, snapshots, verification, and rollback.

## Working capabilities

- fixed host-entrypoint and recipe-operation allowlist checks
- snapshot, verification, and rollback-plan generation
- deterministic operation parameter preservation
- host-version and required-capability visibility

## Honest limitations

- Does not launch Blender or another DCC host, execute scripts, or write files.
- Recipe safety depends on separately reviewed host entrypoints.
- Rollback is a plan until a native transactional host proves it.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
