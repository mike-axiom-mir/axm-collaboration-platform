# Quickstart — AXM Text Fabric v1.0.0 RC

1. Open `START_HERE.html` to browse and tune effects.
2. Open `LAYOUT_STRESS_LAB.html` to test expansion, RTL, narrow widths, safe areas, and line budgets.
3. Run all validation:

```bash
python tests/run_all.py
```

4. Resolve a stress request:

```bash
python -m axm_text_fabric.cli layout-audit examples/request_layout_stress.json --pretty
```

5. Compile a real handoff:

```bash
python -m axm_text_fabric.cli compile-target axm_future_core ./compiled/axm_future_core --platforms web unity unreal godot --force
```

6. Verify it:

```bash
python -m axm_text_fabric.cli verify-bundle ./compiled/axm_future_core --pretty
```

Compiled bundles now include `layout_audit.json` and `pseudolocale_samples.json` alongside font, portable-asset, source-lock, and platform outputs.
