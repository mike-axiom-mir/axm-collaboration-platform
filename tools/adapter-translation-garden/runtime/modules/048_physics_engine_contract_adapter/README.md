# 048 — Physics Engine Contract Adapter

**ID:** `axm.adapter.physics-engine-contract-adapter`  
**Status:** `SHADOW_ONLY`  
**Authority:** `shadow_only`  
**Version:** `0.1.0`

## Purpose

Map bodies, shapes, units, fixed steps, materials, contacts, filters, and determinism claims across physics runtimes.

## Current growth

This capsule currently contains its contract, boundaries, and AXM intake metadata. It is not yet a runtime implementation.

## Hard boundary

This module may not silently acquire permissions, write native state, hide translation loss, or become CANON through intake. Review `module.json` before use.

## AXM intake shape

Copy this folder independently. Preserve its ID and source lineage. Extend existing AXM roots rather than replacing them.
