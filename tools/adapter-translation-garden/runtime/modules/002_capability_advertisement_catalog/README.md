# 002 — Capability Advertisement Catalog

**ID:** `axm.adapter.capability-advertisement-catalog`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.1.0`

## Purpose

Maintain a queryable catalog of what each adapter can read, write, preserve, refuse, verify, and run locally.

## Current growth

A dependency-free, local, pure-function prototype is included.

## Hard boundary

This module may not silently acquire permissions, write native state, hide translation loss, or become CANON through intake. Review `module.json` before use.

## AXM intake shape

Copy this folder independently. Preserve its ID and source lineage. Extend existing AXM roots rather than replacing them.
