# 083 — Path and URL Confinement Guard

**ID:** `axm.adapter.path-url-confinement-guard`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.2.0`

## Purpose

Reject traversal, arbitrary URLs, unrestricted roots, symlink escape, unsafe redirects, and undeclared network destinations.

## Working capabilities

- lexical and resolved path confinement
- encoded traversal rejection
- exact URL destination allowlists
- redirect-chain checking

## Honest limitations

- Symlink safety requires a caller-supplied resolved path from a trusted filesystem boundary.
- No network or filesystem request is performed.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, retain the limitations, add local fixtures, and pass it through AXM's Merge Gate.
