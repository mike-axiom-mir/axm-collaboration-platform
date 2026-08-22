# 069 — Legacy Configuration and Registry Translator

**ID:** `axm.adapter.legacy-config-registry-translator`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.6.0`

## Purpose

Map INI, registry, environment, preference, and obsolete configuration formats into reviewed local profiles.

## Working capabilities

- INI, registry-like, environment, and preference-object normalization
- explicit source-path to target-path mapping rules
- type coercion with visible errors and defaults
- unmapped-value sidecar preservation

## Honest limitations

- Does not read or write registry, environment, preference, or configuration files.
- Only caller-supplied objects/text are translated.
- Application-specific meaning requires reviewed mapping rules.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
