# 080 — Portable Runtime Locator and Bootstrap Adapter

**ID:** `axm.adapter.portable-runtime-locator-bootstrap`  
**Status:** `SHADOW_ONLY`  
**Authority:** `shadow_only`  
**Version:** `0.1.0`

## Purpose

Locate a trusted bundled runtime or obtain a pinned verified runtime through an explicit, reviewable bootstrap path.

## Current growth

This capsule currently contains its contract, boundaries, and AXM intake metadata. It is not yet a runtime implementation.

## Hard boundary

This module may not silently acquire permissions, write native state, hide translation loss, or become CANON through intake. Review `module.json` before use.

## AXM intake shape

Copy this folder independently. Preserve its ID and source lineage. Extend existing AXM roots rather than replacing them.
