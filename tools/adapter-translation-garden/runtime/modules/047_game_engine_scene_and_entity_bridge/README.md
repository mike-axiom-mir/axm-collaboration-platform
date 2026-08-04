# 047 — Game Engine Scene and Entity Bridge

**ID:** `axm.adapter.game-engine-scene-entity-bridge`  
**Status:** `LOCAL_PROTOTYPE`  
**Authority:** `decision_only`  
**Version:** `0.5.0`

## Purpose

Translate scenes, entities, components, assets, events, and lifecycle boundaries across game engines without hiding unsupported features.

## Working capabilities

- scene/entity/component normalization with stable IDs and hierarchy
- explicit component mapping and target-capability checks
- unsupported component sidecars and semantic-loss ledger
- non-executing target scene plan generation

## Honest limitations

- Does not open projects, load engines, convert assets, or write scenes.
- Engine-specific semantics require explicit component maps and fixtures.
- Behavioral parity cannot be inferred from structural mapping alone.

## AXM intake

Copy this capsule independently with `shared/axm_translation_core`. Keep it default-disabled, preserve source lineage and limitations, add local fixtures, and pass it through AXM's Merge Gate.
