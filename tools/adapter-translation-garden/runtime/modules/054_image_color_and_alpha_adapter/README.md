# 054 — Image, Color, and Alpha Adapter

**ID:** `axm.adapter.image-color-alpha-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.4.0`

## Purpose

Translate raster/vector containers, alpha modes, color spaces, profiles, bit depths, orientation, and premultiplication with visible loss.

## Working capabilities

- explicit image descriptor comparison
- alpha premultiplication and unpremultiplication for one normalized pixel
- visible color/profile/bit-depth/orientation conversion planning
- refusal when alpha would be silently destroyed

## Honest limitations

- Does not decode or encode image files.
- Does not perform ICC color transforms.
- Pixel helper operates only on normalized RGBA tuples supplied by the caller.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
