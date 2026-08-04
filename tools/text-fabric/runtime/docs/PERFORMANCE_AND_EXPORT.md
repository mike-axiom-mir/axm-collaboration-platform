# Performance Budgets and Project Export

## Why this organ exists

Premium text can become expensive when blur, bloom, animated sheen, multiple shadows, scanlines, and glitch passes are combined. The render-cost budget organ keeps the same identity while scaling the effect stack to the target hardware.

## Quality tiers

### Low
Designed for phones, handhelds, older integrated graphics, dense interfaces, and battery-sensitive use.

- glow blur capped
- plate blur heavily reduced
- one shadow layer
- animated sheen disabled
- glitch becomes static and minimal
- sparkle disabled

### Balanced
The default practical target.

- moderate glow and blur
- up to two shadow layers
- modest sheen
- readable glitch offsets capped

### High
For capable desktop and game targets.

- richer glow and blur
- full material treatment retained where reasonable
- larger but still readable glitch limits

### Cinematic
Preserves the authored stack. Use for title cards, capture, trailers, or rare hero moments—not every label on screen.

## Compiler outputs

Use `compile-target` when the ID may be either a preset or recipe.

Every compiled target now writes:

- `bundle_manifest.json`
- `AXM_TEXT_LOCK.json`
- `source_snapshot/`
- `INSTALL.md` and `ROLLBACK.md`
- one folder per requested platform
- `resolved_plan.json` and `adapter.json`
- complete web runtime CSS and preview HTML
- generated Unity C# parameter application code
- generated Unreal dynamic-material parameter code
- generated Godot shader setup code
- SHA-256 hashes for verification

Use `compile-library` to build multiple or all presets into a navigable library.
Use `verify-bundle` before intake or deployment.

The compiler never overwrites an existing non-empty output directory unless `--force` is supplied.
