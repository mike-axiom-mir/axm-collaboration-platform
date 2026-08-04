# 033 — Event-to-Command Adapter

**ID:** `axm.adapter.event-command-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Turn selected facts into proposed commands only through declared policy and authority gates.

## Working capabilities

- explicit event-type to command-type mappings
- field-level mapping and constant injection
- source event provenance preservation
- refusal for unmapped required fields

## Honest limitations

- Does not dispatch commands.
- Does not infer mappings from names.
- One event maps to one command in this prototype.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
