# 061 — Legacy Text Encoding Decoder

**ID:** `axm.adapter.legacy-text-encoding-decoder`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Decode legacy character sets with confidence, reversible byte preservation, fallback maps, and ambiguity reports.

## Working capabilities

- strict reviewed codec candidates
- confidence and ambiguity report
- exact byte round-trip checks
- base64 source preservation

## Honest limitations

- Encoding identification cannot be universally certain.
- Codec allowlist is intentionally limited.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
