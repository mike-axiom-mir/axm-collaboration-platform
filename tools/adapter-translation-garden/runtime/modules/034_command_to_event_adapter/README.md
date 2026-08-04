# 034 — Command-to-Event Adapter

**ID:** `axm.adapter.command-event-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Emit attributable outcome events from commands without presenting an intention as a completed fact.

## Working capabilities

- explicit command-result to event mappings
- field-level mapping and constant injection
- causation and correlation preservation
- refusal for unmapped required fields

## Honest limitations

- Does not publish events.
- Does not infer domain semantics.
- One command result maps to one event in this prototype.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
