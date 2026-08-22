# 062 — Filesystem Path Semantics Adapter

**ID:** `axm.adapter.filesystem-path-semantics-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Translate separators, roots, drive letters, reserved names, symlinks, permissions, maximum lengths, and relative-path rules.

## Working capabilities

- POSIX/Windows path translation
- explicit root maps
- reversible reserved-name escapes
- length and traversal refusal

## Honest limitations

- Does not touch a filesystem or apply symlinks/permissions.
- Case collisions are delegated to module 063.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
