# Deployment, Compilation, Integrity, and Rollback

AXM Text Fabric v0.7.0 can compile either a **preset** or a **recipe** into project handoff folders.

## Compile any known target

```bash
python -m axm_text_fabric.cli compile-target readable_glitch ./compiled/readable_glitch   --platforms web unity unreal godot   --quality-tier balanced
```

`compile-target` auto-detects whether the ID belongs to the preset gallery or recipe catalog.

## Compile a preset explicitly

```bash
python -m axm_text_fabric.cli compile-preset axm_future_core ./compiled/axm_future_core
```

## Compile a recipe explicitly

```bash
python -m axm_text_fabric.cli compile-recipe molten_gold ./compiled/molten_gold   --text "GOLDEN VICTORY" --role game_reward_title
```

## Compile a reusable library

```bash
python -m axm_text_fabric.cli compile-library ./compiled/library   --platforms web unity unreal godot   --quality-tier balanced   --featured-only
```

You can also use `--ids`, or filter with `--category Software`.

## What a compiled target contains

- `source_snapshot/`
- `AXM_TEXT_LOCK.json`
- `bundle_manifest.json`
- `INSTALL.md`
- `ROLLBACK.md`
- one folder per requested platform
- resolved plans and adapter contracts
- import instructions
- generated project starter files

## Platform handoffs

### Web
- runtime CSS
- compiled variables CSS
- working HTML example

### Unity
- `Assets/AXMTextFabric/Scripts/`
- shared AXM Text Fabric hands
- a generated C# parameter applier for the selected target

### Unreal
- `Source/AXMTextFabric/Public/`
- style headers
- a generated header that applies resolved parameters to a dynamic material instance

### Godot
- `addons/axm_text_fabric/`
- shader and resources
- generated GDScript setup hand

## Verify before intake

```bash
python -m axm_text_fabric.cli verify-bundle ./compiled/axm_future_core --pretty
```

Verification reports:
- missing files
- modified files
- untracked files
- nested manifest changes in compiled libraries

## Rollback model

Compiled folders are disposable outputs. They never silently rewrite the preset or recipe source.

Rollback means deleting the generated folder and either:
1. restoring the previous generated folder, or
2. regenerating from the source snapshot or versioned AXM Text Fabric package.


## Audit multilingual or suspicious text

```bash
python -m axm_text_fabric.cli audit-text "AXM مرحبا 世界" --pretty
```

The audit reports scripts, direction, mixed-direction risk, combining marks, explicit bidi controls, private-use glyphs, replacement characters, and fallback requirements. It does not claim that a specific font file contains those glyphs; project font coverage still needs target-device QA.
