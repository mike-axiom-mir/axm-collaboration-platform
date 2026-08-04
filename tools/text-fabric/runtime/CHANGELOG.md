# AXM Text Fabric Changelog

## v1.0.0 RC — Layout Resilience and Pseudo-localization
- Added Layout Resilience Organ.
- Added Pseudo-localization Stress Organ.
- Added Safe Area & Viewing Distance Organ.
- Added deterministic accented, expanded, and pseudo-RTL variants with placeholder preservation.
- Added overflow, line-budget, safe-area, and platform minimum-size auditing.
- Added strict layout compilation policy.
- Added `stress-text`, `layout-audit`, and `layout-qa` CLI commands.
- Added `LAYOUT_STRESS_LAB.html`.
- Compiled bundles now include `layout_audit.json` and `pseudolocale_samples.json`.


## v0.9.0 — Actual Font Coverage and Fallback Planning
- Added dependency-free TTF, OTF, and TTC inspection.
- Added actual text-to-font glyph coverage auditing.
- Added variable-font axis, GSUB/GPOS, color-font, outline, metrics, and license metadata reporting.
- Added strict/warn/off font coverage policies during resolution and compilation.
- Added metadata-only font registry generation.
- Added deterministic fallback-stack planning for mixed-language text.
- Compiled bundles can include `font_audit.json` and `font_stack_plan.json` without copying fonts.
- Local font and registry paths are redacted from source snapshots while SHA-256 identity is retained.

## v0.8.0 — Portable Asset Baking and Visual QA
- Added portable SVG generation from resolved plans.
- Added optional PNG baking through Inkscape, rsvg-convert, or ImageMagick.
- Added portable assets to every compiled bundle.
- Added quality-tier visual QA matrix generation with hashed assets and offline gallery.
- Added two organs, two schemas, CLI commands, scripts, documentation, and tests.

## v0.7.0 — Deployment, Integrity, and Batch Compilation
- Added auto-detected `compile-target` for presets or recipes.
- Added explicit `compile-recipe`.
- Added `compile-library` for category, featured, selected, or full preset batches.
- Added `verify-bundle` with missing, modified, untracked, and nested-manifest detection.
- Compiled targets now include source snapshots, lock files, install notes, and rollback notes.
- Web exports now include runtime CSS and a complete preview page.
- Unity exports now include generated C# parameter application code.
- Unreal exports now include generated dynamic-material parameter code.
- Godot exports now include generated GDScript setup code.
- CLI failures now return clean errors instead of tracebacks.
- Fixed the stale Python package version marker.
- Added Unicode glyph/script/fallback auditing and `audit-text`.
- Reduced glitch jitter automatically for RTL or mixed-direction text.

## v0.6.0 — Adaptive Performance + Preset Workshop + Compiler
- Added **Render Cost Budget Organ** with `low`, `balanced`, `high`, and `cinematic` tiers.
- Added **Preset Workshop Organ** for local custom preset save, import, replacement, and deletion.
- Added `compile-preset` CLI command to generate deterministic export bundles for web, Unity, Unreal, Godot, desktop, and game targets.
- Added bundle manifests and SHA-256 hashes.
- Added platform and quality-tier controls to the standalone browser.
- Added tests for performance caps, custom preset structure, and compiler output.

## v0.5.0 — Preset Browser
- Added searchable preset gallery with 24 inspectable configurations.
- Added local-only favorites, CSS/JSON copy, and JSON download.
- Added machine-facing preset listing and resolution.

## v0.4.0 — Engine-Native Shader / Material Pack
- Added shader routing and starter material hands for Unity, Unreal, and Godot.

## v0.3.0 — Readable Futuristic Glitch Upgrade
- Added Readable Glitch recipe and Glitch Safety Organ.

## v0.2.0 — Material & Special Effects Upgrade
- Added Molten Gold, Silver Chrome, Neon Metal, and Holo Prism.

## v0.1.0
- Initial release.
