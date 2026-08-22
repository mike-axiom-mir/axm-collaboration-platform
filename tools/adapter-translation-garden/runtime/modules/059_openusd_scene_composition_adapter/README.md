# 059 — OpenUSD Scene Composition Adapter

**ID:** `axm.adapter.openusd-scene-composition-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Map layered scene description, references, variants, time samples, assets, and plugin-backed formats without flattening composition silently.

## Working capabilities

- abstract OpenUSD layer-stack inspection
- sublayer cycle detection
- variant and composition-arc inventory
- plan-only flattening and packaging decisions

## Honest limitations

- Does not parse USDA, USDC, or USDZ files.
- Does not invoke an OpenUSD runtime.
- Composition semantics are limited to the explicit abstract descriptor supplied by the caller.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
