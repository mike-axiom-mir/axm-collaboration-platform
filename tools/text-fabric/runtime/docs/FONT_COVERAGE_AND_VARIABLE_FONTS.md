# Font Coverage and Variable-Font Audit

AXM Text Fabric v0.9.0 can inspect project-owned `.ttf`, `.otf`, and `.ttc` files using only Python's standard library. No font binary is bundled or copied.

## Inspect a font

```bash
python -m axm_text_fabric.cli font-info ./fonts/MyFont.ttf --pretty
```

The report includes names, SHA-256, glyph and codepoint counts, Unicode script coverage, variable axes, shaping tables, color-font capabilities, and license metadata when present.

## Check real text coverage

```bash
python -m axm_text_fabric.cli audit-font ./fonts/MyFont.ttf "SYSTEM READY العربية 日本語" --pretty
```

This reports each missing codepoint and warns about shaping-sensitive scripts when GSUB/GPOS support is absent.

## Build a local registry

```bash
python -m axm_text_fabric.cli build-font-registry ./font_registry.json ./fonts --redact-paths --pretty
```

## Compile with a font gate

```bash
python -m axm_text_fabric.cli compile-target readable_glitch ./compiled/readable_glitch \
  --platforms web unity unreal godot \
  --font-file ./fonts/MyFont.ttf \
  --font-policy strict \
  --force
```

`strict` stops compilation when a required glyph is absent. `warn` records the audit and continues. `off` skips file inspection.

## Variable fonts

When an `fvar` table is present, AXM reports axis tags, names, minimums, defaults, maximums, and hidden-axis state. The engine still needs to map those axes to its own runtime APIs.

## Boundaries

- Coverage does not guarantee beautiful shaping. Test the target engine and operating system.
- Font files remain licensed project assets and are never included in the AXM package.
- A registry is metadata, not permission to redistribute a font.

## Plan a fallback stack

After building a registry, AXM can choose a small ordered font set that collectively covers the requested text:

```bash
python -m axm_text_fabric.cli plan-font-stack ./font_registry.json "AXM العربية 日本語 😀" --pretty
```

The planner uses deterministic greedy set coverage. It solves character availability, not visual harmony; compare x-height, weight, baseline, and punctuation before shipping.
