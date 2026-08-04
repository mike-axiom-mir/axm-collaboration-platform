# 040 — Error and Status Normalizer

**ID:** `axm.adapter.error-status-normalizer`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Map transport errors, domain errors, exit codes, protocol statuses, partial success, retryability, and human-facing explanations.

## Working capabilities

- HTTP, gRPC, process-exit, and generic status normalization
- source status and message preservation
- retryability hints without retry execution
- unknown-status visibility

## Honest limitations

- Mappings are conservative and finite.
- Does not throw, retry, log, or send errors.
- Domain-specific errors need explicit extension maps.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
