# 058 — glTF Runtime Asset Adapter

**ID:** `axm.adapter.gltf-runtime-asset-adapter`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.4.0`

## Purpose

Import and export glTF/GLB scenes with extension negotiation, scale/axis parity, material checks, animation checks, and validator receipts.

## Working capabilities

- glTF 2.0 descriptor validation for core references
- unknown extension visibility
- external URI confinement checks without fetching
- runtime asset summary generation

## Honest limitations

- Does not load buffers, images, meshes, shaders, or external URIs.
- Does not render or validate every glTF specification rule.
- Draco, meshopt, KTX, and vendor extensions remain declared but unexecuted.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
