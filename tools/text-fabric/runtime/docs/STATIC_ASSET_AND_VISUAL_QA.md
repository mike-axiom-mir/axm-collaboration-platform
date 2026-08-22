# Portable Static Assets and Visual QA

AXM Text Fabric v0.8.0 can now produce visual artifacts without needing a game engine or browser runtime.

## Export one asset

```bash
python -m axm_text_fabric.cli export-static readable_glitch   ./exports/readable_glitch.svg   --text "SYSTEM READY"   --quality-tier balanced   --png   --force
```

The SVG is always dependency-free. PNG rendering is optional and uses the first available renderer:

1. Inkscape
2. rsvg-convert
3. ImageMagick

## Build a QA matrix

```bash
python -m axm_text_fabric.cli qa-matrix ./qa   --ids axm_future_core golden_victory chrome_system protected_subtitle   --quality-tiers low balanced high cinematic   --force
```

The output includes:

- one SVG per target/tier combination
- optional PNG renderings
- `qa_manifest.json`
- an offline `index.html` gallery
- per-asset hashes and render-budget data

## Why this matters

The same style can look acceptable at cinematic quality and become wasteful on a handheld. The QA matrix makes those changes visible and ties each image back to the resolved quality tier and cost estimate.

## Static asset boundary

The SVG keeps text as SVG text so it remains small and inspectable. It references the resolved font-family stack but does not bundle fonts or convert licensed glyphs into paths. Exact metrics therefore depend on available fonts. Projects needing exact cross-device results should use a project-owned font and perform their own path or texture bake.

## Design law

The portable path follows the same law as the engine path: **the readable glyph core survives when every decorative layer is removed.**
