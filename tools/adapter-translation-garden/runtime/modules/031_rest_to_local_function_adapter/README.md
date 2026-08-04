# 031 — REST-to-Local Function Adapter

**ID:** `axm.adapter.rest-local-function-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Expose a bounded local function through REST semantics or consume REST through a local typed call without leaking transport details into domain logic.

## Working capabilities

- OpenAPI-like REST operation to local-function binding plans
- explicit request-field to argument mapping
- required parameter validation
- call construction without invocation

## Honest limitations

- Does not start an HTTP server or call local functions.
- Supports a small declared operation subset.
- Authentication and authorization remain separate gates.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
