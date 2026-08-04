# 060 — Archive and Package Translator

**ID:** `axm.adapter.archive-package-translator`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.4.0`

## Purpose

Translate ZIP-like packages, manifests, paths, permissions, compression, and nested payloads with traversal and bomb protection.

## Working capabilities

- in-memory ZIP inventory without extraction
- path traversal, absolute path, symlink, encryption, and compression-ratio checks
- package limit enforcement
- plan-only target-package translation

## Honest limitations

- Only ZIP containers are inspected in the current prototype.
- Does not extract files or execute package contents.
- Bomb heuristics reduce risk but cannot prove arbitrary archive safety.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
