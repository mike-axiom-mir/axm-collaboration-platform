# 064 — Line-Ending and Text-Mode Adapter

**ID:** `axm.adapter.line-ending-text-mode-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Translate newline and legacy text-mode behavior while preserving binary files and exact-source evidence.

## Working capabilities

- binary-preserving text detection
- LF/CRLF/CR translation
- BOM preservation
- explicit DOS EOF handling

## Honest limitations

- Undecodable content is preserved rather than guessed.
- Encoding conversion is outside this module.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
