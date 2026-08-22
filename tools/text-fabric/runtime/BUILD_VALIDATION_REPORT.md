# BUILD VALIDATION REPORT — AXM Text Fabric v1.0.0 RC

Status: **PASS — WORKING RELEASE CANDIDATE**

## Purpose of this run

This final steward run closed the remaining layout failure modes rather than adding more visual decoration.

## Added

- Layout Resilience Organ
- Pseudo-localization Stress Organ
- Safe Area & Viewing Distance Organ
- Deterministic accented, expanded, and pseudo-RTL generation
- Placeholder, tag, URL, and email-like token preservation
- Line-budget and overflow estimation
- TV, console, handheld, mobile, desktop, VR, and world-space guidance
- Strict layout compilation gate
- `stress-text`, `layout-audit`, and `layout-qa` commands
- Standalone `LAYOUT_STRESS_LAB.html`
- `layout_audit.json` and `pseudolocale_samples.json` in compiled bundles

## Validation results

- Tests: **19 passed, 0 failed**
- Package files audited: **281**
- JSON files parsed: **108**
- Python files compiled: **35**
- Inline JavaScript blocks syntax-checked: **2**
- Organs: **30**
- Recipes: **13**
- Built-in presets: **24**
- SVG assets validated: **25**
- PNG proof assets present: **25**
- Bundled font binaries: **0**

## Layout proof

- Offline layout QA rows: **64**
- Strict one-line narrow-HUD failure exited cleanly with code **2**
- Strict failure contained no traceback
- Representative Web, Unity, Unreal, and Godot bundle hash-verified
- Packaged compiled example hash-verified
- Compiled bundles include layout audit and pseudo-locale samples

## Full-library regression

- Preset bundles compiled: **24**
- Platforms per bundle: Web, Unity, Unreal, Godot
- Files verified: **1,036**
- Layout audits: **24**
- Pseudo-locale sample files: **24**
- Bundled font binaries: **0**
- Integrity result: **PASS**

## Honest boundaries

- Layout measurements are deterministic heuristics, not a replacement for exact shaping in the target renderer.
- Final kerning, ligatures, glyph advances, line breaks, and bidi shaping still require the real project font stack inside the target engine.
- Unity, Unreal, and Godot outputs were structurally generated and hash-verified, but were not imported into their proprietary editors in this environment.
- Pseudo-localized text is a stress artifact, not a translation.

## Intake recommendation

Use v1.0.0 as the new intake candidate. Retain v0.9.0 temporarily as the rollback checkpoint until one real AXM interface and one real game/engine consumer have completed local acceptance.
