from __future__ import annotations
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "shared"))
from tools.module_loader import load_implementation
from axm_translation_core import add_loss, new_loss_ledger

source = json.loads((ROOT / "examples" / "sample_contract.json").read_text(encoding="utf-8"))
translated = json.loads(json.dumps(source))
translated["properties"]["body"] = {"type": "string"}

harvest = load_implementation(1).run(source)
dialect = load_implementation(4).run(source)
fingerprint = load_implementation(3).run(source)
negotiation = load_implementation(6).run(["2020-12", "draft-07"], ["2020-12"])
allow = load_implementation(81).run(
    {"operation": "preview", "path": "/local/demo"},
    {"operations": ["preview"], "paths": ["/local/demo"]},
)
diff = load_implementation(85).run(source, translated)
ledger = new_loss_ledger()
add_loss(
    ledger,
    kind="narrowed_null_semantics",
    path="$.properties.body.type",
    source_value=["string", "null"],
    target_value="string",
    reason="Target demo representation cannot express nullable body",
    severity="high",
    reversible=True,
)
proof = load_implementation(90).run(
    request_id="demo-001",
    source=source,
    target=translated,
    loss_ledger=ledger,
    authority={"mode": "preview_only", "native_write": False, "network": False},
    claims=[{"claim": "declared_structure_inspected", "passed": True}],
)
explanation = load_implementation(99).run(proof)

print("AXM SAFE TRANSLATION PIPELINE DEMO")
print("- Dialect:", dialect)
print("- Harvested operations:", len(harvest["operations"]))
print("- Fingerprint:", fingerprint["digest"][:16] + "...")
print("- Negotiated:", negotiation["selected"])
print("- Allowlist:", allow["allowed"])
print("- Differences:", len(diff["changes"]))
print("- Verdict:", proof["verdict"])
print("\nHUMAN EXPLANATION\n" + explanation)
