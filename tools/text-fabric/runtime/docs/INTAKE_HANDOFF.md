# AXM Local Intake Handoff — v1.0.0 RC

Recommended placement:

`/AXM_LIBRARY/CREATE/VISUAL/TEXT_FABRIC/AXM_TEXT_FABRIC_v1_0_0/`

Suggested integration order:

1. Register `manifest.json`.
2. Import `tokens/`, `recipes/`, `presets/`, `organs/`, and `schemas/` as versioned inputs.
3. Run `python tests/run_all.py`.
4. Open `START_HERE.html` and `LAYOUT_STRESS_LAB.html` locally.
5. Register `axm_text_fabric.cli` as the machine-facing tool.
6. Use `list-presets`, `resolve-preset`, `layout-audit`, and `stress-text` before compilation.
7. Compile a representative target for Web, Unity, Unreal, and Godot.
8. Verify the generated bundle with `verify-bundle`.
9. Connect adapter outputs to AXM Style Fabric, Aetherglass Visual Engine, Visual Mold, game UI, web UI, and app UI without merging their internals.
10. Keep v0.9.0 as the temporary rollback checkpoint until real local consumers accept v1.0.0.

Rollback boundary: restoring the previous versioned directory restores behavior without touching project content or project-owned font files.
