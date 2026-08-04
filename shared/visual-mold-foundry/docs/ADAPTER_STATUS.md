# ADAPTER STATUS — v0.6

The browser Studio is the validated local reference runtime. Downstream adapters are **data-only mapping scaffolds** and do not execute target software.

| Target | Scaffold | Structural status | Engine status | Visual parity claim |
|---|---|---|---|---|
| Blender | Semantic node/material plan | STRUCTURALLY TESTED | LOCAL VALIDATION REQUIRED | No |
| Godot | Shader/theme parameter plan | STRUCTURALLY TESTED | LOCAL VALIDATION REQUIRED | No |
| ComfyUI | Workflow/conditioning plan | STRUCTURALLY TESTED | LOCAL VALIDATION REQUIRED | No |
| Unity | Material, UI, and shader-parameter plan | STRUCTURALLY TESTED | LOCAL VALIDATION REQUIRED | No |
| Unreal Engine | Material-instance, UMG, and post-process plan | STRUCTURALLY TESTED | LOCAL VALIDATION REQUIRED | No |
| MaterialX | Standard-surface/emission plan | STRUCTURALLY TESTED | LOCAL VALIDATION REQUIRED | No |

Example:

```text
python tools/export_adapter_plan.py blender exported-skin.json --output blender-plan.json
```

Each adapter package records `visual_parity_claim: false`. A generated plan still requires review and testing inside the target tool.
