# 003 — Contract Fingerprint Service

**ID:** `axm.adapter.contract-fingerprint-service`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.1.0`

## Purpose

Create stable digests for schemas, API descriptions, operation allowlists, semantic maps, and adapter descriptors so drift is visible.

## Current growth

A dependency-free, local, pure-function prototype is included.

## Hard boundary

This module may not silently acquire permissions, write native state, hide translation loss, or become CANON through intake. Review `module.json` before use.

## AXM intake shape

Copy this folder independently. Preserve its ID and source lineage. Extend existing AXM roots rather than replacing them.
