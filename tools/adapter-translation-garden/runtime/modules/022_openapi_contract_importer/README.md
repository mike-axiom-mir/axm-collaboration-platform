# 022 — OpenAPI Contract Importer

**ID:** `axm.adapter.openapi-contract-importer`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `read_only_descriptor`  
**Version:** `0.5.0`

## Purpose

Convert OpenAPI operations into bounded AXM tool contracts, fixtures, permissions, and refusal states.

## Working capabilities

- OpenAPI 3.x path and operation normalization
- parameter, request-body, response, tag, and declared-security preservation
- duplicate operation identifier and malformed path detection
- local JSON-reference inventory without remote retrieval

## Honest limitations

- Does not call APIs, resolve remote references, generate clients, or grant permissions.
- Supports the common OpenAPI object shape, not every vendor extension or dialect edge case.
- Security declarations are evidence only and never become authority grants.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
