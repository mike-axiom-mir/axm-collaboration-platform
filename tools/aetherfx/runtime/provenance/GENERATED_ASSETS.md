# Generated Asset Provenance

## Project code and documents

Generated for Mike — Axiom/Mir on 2026-07-28 as the AXM AetherFX Visual Effect Fabric foundation, expanded through v1.3.0 stewardship. No third-party JavaScript packages, web fonts, trackers, or remote assets are required by the studio runtime.

## Blueprint images

The three images in `assets/visuals` were generated within the current ChatGPT creation session from the AXM concept brief:

1. Concept Architecture
2. Implementation Plan
3. Starter Modular Pack

They are supporting visual records, not runtime dependencies.

## Catalog

The module names, descriptions, renderer declarations, presets, and scene structures were authored specifically for this package. Their default license remains unset until Mike chooses a public-sharing policy.

## Canonical-to-runtime generation

Canonical bridge files are generated rather than maintained by hand:

- `src/catalog/catalog.generated.js` from `catalog/default-catalog.json`
- `src/app/runtime-css.generated.js` from `styles/runtime.css`
- `dist/runtime/axm-aether-runtime.js` and `.mjs` from the core, runtime facade, and canonical catalog
- `dist/AXM_AETHERFX_VISUAL_EFFECT_FABRIC_STUDIO_v1_3_0.html` and `OPEN_STUDIO.html` from the readable Studio sources

Run `npm run generated` after changing the catalog or runtime CSS, or `npm run build` to regenerate the complete runtime and Studio outputs. This prevents the editor, standalone exporter, portable runtime, and catalog from silently drifting apart.

The 12 files under `packages/starter/` are also generated from the canonical catalog by `tools/build-starter-packages.mjs`. Dependency closure is resolved before each package is sealed with SHA-256. This keeps shareable packages synchronized with their built-in definitions.
