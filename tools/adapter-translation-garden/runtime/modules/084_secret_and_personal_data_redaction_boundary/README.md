# 084 — Secret and Personal-Data Redaction Boundary

**ID:** `axm.adapter.secret-pii-redaction-boundary`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Prevent tokens, private payloads, identities, and sensitive fields from crossing translation, logs, proofs, or public exports.

## Working capabilities

- recursive key-policy redaction
- opt-in personal-field redaction
- bounded token/email/IP patterns
- non-secret findings

## Honest limitations

- Pattern detection is incomplete by design.
- Redaction reports prove configured coverage only.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
