# 043 — Native FFI Safety Wrapper

**ID:** `axm.adapter.native-ffi-safety-wrapper`  
**Status:** `SHADOW_ONLY`  
**Authority:** `shadow_only`  
**Version:** `0.1.0`

## Purpose

Wrap foreign-function calls with typed memory ownership, ABI checks, crash isolation, allowlists, and refusal of unsafe pointers.

## Current growth

This capsule currently contains its contract, boundaries, and AXM intake metadata. It is not yet a runtime implementation.

## Hard boundary

This module may not silently acquire permissions, write native state, hide translation loss, or become CANON through intake. Review `module.json` before use.

## AXM intake shape

Copy this folder independently. Preserve its ID and source lineage. Extend existing AXM roots rather than replacing them.
