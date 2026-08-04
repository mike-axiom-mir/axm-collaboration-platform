# 011 — Canonical Entity Envelope

**ID:** `axm.adapter.canonical-entity-envelope`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.1.0`

## Purpose

Wrap translated entities with stable identity, source system, native ID, schema, provenance, limitations, and authority boundaries without stealing native ownership.

## Current growth

A dependency-free, local, pure-function prototype is included.

## Hard boundary

This module may not silently acquire permissions, write native state, hide translation loss, or become CANON through intake. Review `module.json` before use.

## AXM intake shape

Copy this folder independently. Preserve its ID and source lineage. Extend existing AXM roots rather than replacing them.
