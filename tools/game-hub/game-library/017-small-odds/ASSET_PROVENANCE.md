# Asset provenance

## `runtime/assets/small-odds-key-art-v1.png`

- Created for this project on 2026-07-28 with OpenAI's built-in image generation tool.
- Prompt class: `stylized-concept`.
- Purpose: title/loading key art and visual-direction anchor.
- Original prompt requested a tiny original alien, a non-water luminous sea, an electroluminescent portal-shell creature, oversized alien settlement, and no text, logo, watermark, humans, weapons, franchise characters, or copyrighted visual references.
- The asset is project-bound and copied into this package; the original generated output remains in the local Codex generated-images store.

## Runtime visuals

All animated world rendering, item glyphs, interface shapes, particles, characters, and effects are original project-local HTML, CSS, Canvas, and WebGL code. `runtime/world-three.js` builds its low-poly geometry, Pip, architecture, route markers, 16-step lighting shader, and location palettes from project-local source at runtime. It uses no downloaded engine, model, texture, material, font, or third-party runtime asset. System fonts are used; the package makes no network requests.

The WebGL layer is a deliberately bounded visual baseline, not a production character/model/rig/animation asset library.
