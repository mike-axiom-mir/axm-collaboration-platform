# AXM Text Fabric v1.0.0 — Release Candidate

A local-first modular system for professional, readable, expressive, and platform-correct text across games, websites, apps, dashboards, launchers, subtitles, HUDs, and world-space interfaces.

The fabric is not a font collection. It is the logic around fonts and text: semantic roles, responsive sizing, contrast protection, materials, glow, metal, gold, holographic and readable glitch effects, rendering strategy, hardware budgets, font coverage, fallback planning, portable assets, compilation, integrity, and layout resilience.

## Current capability

- 30 independently inspectable organs
- 13 visual recipes
- 24 built-in presets plus local custom presets
- Web, Unity, Unreal, Godot, desktop, mobile, and portable handoffs
- Multi-platform preset and recipe compiler
- SVG and optional PNG asset baking
- Bundle hashes, source snapshots, rollback instructions, and tamper verification
- TTF, OTF, and TTC coverage inspection without bundling font files
- Metadata-only font registries and fallback-stack planning
- Unicode, hidden-control, script, direction, and glyph auditing
- Pseudo-localization, overflow, safe-area, RTL, and viewing-distance preflight

## Human entry points

- `START_HERE.html` — preset workshop and effect browser
- `LAYOUT_STRESS_LAB.html` — narrow-screen, expansion, RTL, and safe-area laboratory

## CLI examples

```bash
python -m axm_text_fabric.cli resolve examples/request_game_reward.json --pretty
```

```bash
python -m axm_text_fabric.cli compile-target readable_glitch ./compiled/glitch --platforms web unity unreal godot --force
```

```bash
python -m axm_text_fabric.cli stress-text "System ready {name}" --mode all --pretty
```

```bash
python -m axm_text_fabric.cli layout-audit examples/request_layout_stress.json --pretty
```

```bash
python -m axm_text_fabric.cli layout-qa ./layout_qa --ids axm_future_core golden_victory --widths 320 768 1280 --force
```

## Core boundary

**The readable glyph core is authoritative.** Materials, glow, sheen, glitch, animation, and atmosphere are supporting layers. Exact shaping and final line breaks still require verification in the target renderer with the selected project font stack.

## Font policy

No font binaries are bundled. Project fonts are inspected locally and referenced through redacted metadata and hashes only.
