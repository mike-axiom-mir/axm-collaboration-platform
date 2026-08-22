# 100 — Bounded Translation Orchestrator

**ID:** `axm.adapter.bounded-translation-orchestrator`  
**Status:** `SHADOW_ONLY`  
**Authority:** `shadow_only`  
**Version:** `0.1.0`

## Purpose

Coordinate discovery, negotiation, preview, approval, translation, verification, rollback, and evidence without gaining hidden authority.

## Current growth

This capsule currently contains its contract, boundaries, and AXM intake metadata. It is not yet a runtime implementation.

## Hard boundary

This module may not silently acquire permissions, write native state, hide translation loss, or become CANON through intake. Review `module.json` before use.

## AXM intake shape

Copy this folder independently. Preserve its ID and source lineage. Extend existing AXM roots rather than replacing them.
