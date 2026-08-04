# 017 — Coordinate and Spatial Frame Translator

**ID:** `axm.adapter.coordinate-frame-translator`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `inspect_only`  
**Version:** `0.2.0`

## Purpose

Translate handedness, axes, origins, pivots, units, orientation, geospatial frames, and screen/world coordinate spaces.

## Working local prototype

- axis and sign remapping
- origin and unit conversion
- 2D/3D semantic frame translation
- handedness change visibility

The implementation is dependency-free Python and defaults to no network access, no native writes, no installation, and no AXM authority.

## Honest limitations

- Point and vector translation only.
- No quaternion, Euler, matrix, geodesy, curved-earth, or projection implementation.
- Pixel conversion requires meters_per_pixel.

## Quick use

Load `implementation.py` directly or use `tools/module_loader.py`. Review the fixtures and run `python run_tests.py` before intake.

## AXM intake

Copy this folder individually together with `shared/axm_translation_core`. Preserve the module ID, source lineage, limitations, and `default_enabled=false`. AXM decides EXTEND, BRIDGE, MERGE, HOLD, or REJECT through its own Merge Gate.
