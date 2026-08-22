# Unity Adapter Scaffold

**Status:** LOCAL VALIDATION REQUIRED  
**Visual parity claim:** No

The canonical mapping is in `registry/adapters/unity.json`.

Generate a data-only plan from an exported AXM skin manifest or mold package:

```text
python tools/export_adapter_plan.py unity path/to/export.json --output unity_plan.json
```

The plan does not execute imported code and does not control the target engine. A human must build and validate the closest implementation, record mismatches, and approve it locally.
