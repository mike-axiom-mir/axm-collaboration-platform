# 098 — Versioned Adapter Package Manager

**ID:** `axm.adapter.versioned-package-manager`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.6.0`

## Purpose

Install, pin, verify, update, quarantine, and roll back signed adapter packages without automatic canon promotion.

## Working capabilities

- adapter package manifest, content-hash, signature-evidence, compatibility, and dependency checks
- pin, update, quarantine, and rollback lifecycle plans
- version comparison and downgrade visibility
- no automatic CANON promotion or installation

## Honest limitations

- Does not install, unpack, execute, sign, or delete packages.
- Cryptographic signature verification must be supplied as evidence by a separate verifier.
- Dependency constraint support is bounded to exact and minimum versions.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
