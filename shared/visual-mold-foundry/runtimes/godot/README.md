# Godot Adapter Scaffold

**Status:** LOCAL VALIDATION REQUIRED  
**Visual parity claim:** No

The canonical mapping is in `registry/adapters/godot.json`.

Generate a plan from an exported AXM skin manifest or mold package:

```text
python tools/export_adapter_plan.py godot path/to/export.json --output godot_plan.json
```

The plan is data only. It does not execute imported code or control the target
application. A human must validate the closest target implementation and record
any mismatch before approval.
