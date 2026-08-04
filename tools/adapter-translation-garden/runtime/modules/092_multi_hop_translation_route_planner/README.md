# 092 — Multi-Hop Translation Route Planner

**ID:** `axm.adapter.multi-hop-route-planner`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.6.0`

## Purpose

Find candidate translation routes while preventing cycles and exposing each intermediate representation.

## Working capabilities

- bounded breadth-first multi-hop route enumeration
- cycle prevention and explicit intermediate representation visibility
- edge enabled, verified, authority, and required-capability constraints
- deterministic route ordering and max-route limits

## Honest limitations

- Does not execute, compose, or validate adapters.
- Graph metadata is caller-supplied and must be independently verified.
- Route existence does not imply semantic fidelity.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
