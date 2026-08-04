# Generic Game Adapter Contract

This folder does **not** claim a native game-engine plugin. It points to the canonical resolved intent a future Unity, Unreal, Godot, or custom renderer should consume.

A native adapter should:

1. Load and validate a recipe plus the required module definitions.
2. Resolve dependencies, composites, derived modules, quality tiers, and exclusive groups.
3. Consume `axm.resolved-visual-intent/1` operations in order, including target roles and fallback origin.
4. Map intent to engine materials, particles, post-processing, UI nodes, or sprites.
5. Record every operation as implemented, approximated, contract-only, or unsupported.
6. Preserve reduced-motion, photosensitive-safe, performance, provenance, and rollback behavior.

`visual-intent.schema.json` references the canonical schema at `schemas/resolved-visual-intent.schema.json`. See it with `mapping-example.json`.
