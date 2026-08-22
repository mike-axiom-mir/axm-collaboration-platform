# 025 — Avro Writer–Reader Resolver

**ID:** `axm.adapter.avro-writer-reader-resolver`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.5.0`

## Purpose

Resolve writer and reader schemas with explicit aliases, defaults, promotions, missing-field errors, and schema fingerprints.

## Working capabilities

- record-field resolution by name and reader aliases
- Avro primitive promotion checks and explicit incompatibility reports
- reader-default application and missing-field refusal
- deterministic writer and reader schema fingerprints

## Honest limitations

- Does not decode or encode Avro binary/container files.
- Supports bounded record and primitive/union resolution, not the complete Avro specification.
- Logical types require explicit local extension handling.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
