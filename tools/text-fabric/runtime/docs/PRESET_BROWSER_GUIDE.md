# Preset Browser and Workshop Guide

## Built-in presets
Built-ins are immutable starting points. Tune them freely; reset restores the original values.

## Custom presets
- `Save custom` stores the current configuration in local browser storage.
- `Import JSON` validates recipe and role references before loading.
- `Delete custom` only removes local custom presets.
- Built-ins cannot be deleted.

## Performance budget
Select `Auto`, `Low`, `Balanced`, `High`, or `Cinematic`.
The budget changes decorative cost, not semantic role or core readability.

## Project compiler
Use the CLI when a preset should become a project handoff folder:

```bash
python -m axm_text_fabric.cli compile-preset PRESET_ID OUTPUT_DIR   --platforms web unity unreal godot   --quality-tier balanced
```
