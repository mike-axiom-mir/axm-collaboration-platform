# 037 — HTTP Content Negotiation Adapter

**ID:** `axm.adapter.http-content-negotiation-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Select representations using declared media types, encodings, language, profiles, and quality preferences rather than unsafe guessing.

## Working capabilities

- HTTP Accept media-range parsing
- quality and specificity ranking
- wildcard matching
- deterministic no-match refusal

## Honest limitations

- Negotiates media types only, not language, charset, or encoding.
- Does not send HTTP responses.
- Vendor-specific parameter semantics are preserved but not interpreted.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
