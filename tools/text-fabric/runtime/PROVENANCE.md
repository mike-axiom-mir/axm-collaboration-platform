# Provenance and Boundaries

The architecture is based on established screen-typography practices: semantic type roles, scalable sizing, contrast protection, medium reading measure, platform text systems, font fallbacks, and SDF/MSDF guidance for scalable game text.

No external source code or font binary was copied into this pack. Example code is original and intentionally small. Engine adapter files are configuration starters, not replacements for each engine's built-in text stack.

## Explicit boundaries

- No proprietary font files are included.
- No claim is made that one style recipe fits every font or language.
- Contrast checks use solid foreground/background colors. Dynamic-image contrast still requires scene sampling or manual review.
- SDF/MSDF guidance is routed toward large or heavily transformed game text; tiny text remains a rasterization-sensitive case.
- Complex script shaping is delegated to the target platform or engine text stack.


## Preset browser boundary

- Presets are original configuration examples assembled from the package recipes.
- Browser favorites use local storage and are not transmitted.
- JSON export occurs only through an explicit user action.
- Preset cards are starting points; all live controls remain editable.


## Preset gallery boundary

- The 24 presets are original configuration examples built from this package's recipes.
- Presets remain WORKING starting points, not hidden canon.
- Export occurs only after an explicit copy action.
- No preset bypasses contrast, reduced-motion, localization, or glitch-safety routing.

## v0.5.0 preset boundary

The 24 presets in `presets/preset_gallery.json` are original AXM starting configurations assembled from this pack's own recipes, roles, and tuning values. They contain no external font files, copied templates, or third-party visual assets.

## v0.7.0 compiler and Unicode boundary

- Generated Unity, Unreal, and Godot starter code is original adapter glue produced from AXM configuration data.
- The generated hands are not claimed to be complete engine plugins and still require import/testing inside the target engine editor.
- Unicode auditing uses Python standard-library character metadata and code-point ranges; it does not inspect or redistribute font binaries.
- Fallback requirements are guidance, not proof that a particular installed font contains every needed glyph.
- Compiled bundles are generated outputs with source snapshots and hashes; they do not silently modify canonical recipes or presets.

## v0.8.0 static-render boundary

- SVG and PNG proof assets are generated from AXM configuration data and original adapter logic.
- SVG text references a font-family stack; no font files or third-party glyph outlines are embedded.
- PNG rendering uses a locally installed renderer only when explicitly requested or during visual QA.
- Static assets are fallbacks and proof artifacts; editable/localized runtime text should stay in the target text engine.

## v0.9.0 Font boundary

The font inspector was implemented as a dependency-free SFNT parser for local project-owned TTF, OTF, and TTC metadata. No font file is included in this package. Validation samples contain only metadata, hashes, compressed coverage intervals, and generated reports.

## v1.0.0 layout boundary

- Pseudo-localized strings are generated test artifacts and are not translations.
- Placeholder, tag, URL, and email-like tokens are preserved by the deterministic transformer where recognized.
- Layout measurements are heuristics based on Unicode width classes, role metrics, tracking, container width, and safe-area assumptions.
- Exact shaping, kerning, ligatures, line breaks, and glyph advances remain authoritative only inside the final target renderer with the real font stack.
- Strict layout policy blocks estimated critical failures, but it does not replace target-device QA.
