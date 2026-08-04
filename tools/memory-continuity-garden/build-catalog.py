from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / "runtime"


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


registry = load(RUNTIME / "registry" / "run100_capability_registry.json")
postures = {row["stable_id"]: row["posture"] for row in registry["seeds"]}
rows = []
for module_dir in sorted(path for path in (RUNTIME / "modules").iterdir() if path.is_dir()):
    contract_path = module_dir / "candidate.contract.json"
    compiled_path = module_dir / "compiled_contract.json"
    contract = load(contract_path)
    compiled = load(compiled_path)
    identity = contract["identity"]
    stable_id = identity["stable_id"]
    posture = postures[stable_id]
    rows.append(
        {
            "number": identity["number"],
            "stable_id": stable_id,
            "name": identity["name"],
            "category": identity["category"],
            "risk": contract["scope"]["risk"],
            "purpose": contract["scope"]["purpose"],
            "operation_kind": contract["scope"]["operation_kind"],
            "authority": contract["scope"]["authority"],
            "permissions": contract["scope"]["permissions"],
            "posture": posture,
            "source_status": contract["status"],
            "integration_status": (
                "GOVERNANCE_HOLD"
                if posture == "GOVERNANCE_HOLD_PRESERVED"
                else "REFERENCE_AVAILABLE"
            ),
            "semantic_executable": False,
            "full_semantics_claimed": bool(
                contract.get("semantic_probe", {}).get("full_seed_semantics_implemented")
            ),
            "target": contract["integration"]["target"],
            "non_claims": contract["non_claims"],
            "candidate_contract_sha256": digest(contract_path),
            "compiled_contract_sha256": digest(compiled_path),
            "compiled_source_contract_sha256": compiled["source_contract_sha256"],
            "module_path": module_dir.relative_to(ROOT).as_posix(),
        }
    )

catalog = {
    "schema": "axm.memory.reference-catalog/v1",
    "source": {
        "run": 100,
        "status": registry["status"],
        "canon": False,
        "active_integration": False,
    },
    "counts": {
        "candidates": len(rows),
        "unique_stable_ids": len({row["stable_id"] for row in rows}),
        "semantic_executables": sum(row["semantic_executable"] for row in rows),
        "reference_available": sum(row["integration_status"] == "REFERENCE_AVAILABLE" for row in rows),
        "governance_holds": sum(row["integration_status"] == "GOVERNANCE_HOLD" for row in rows),
    },
    "risk_distribution": dict(sorted(Counter(row["risk"] for row in rows).items())),
    "posture_distribution": dict(sorted(Counter(row["posture"] for row in rows).items())),
    "candidates": rows,
    "boundaries": [
        "The catalog is working; candidates are reference contracts rather than full semantic implementations.",
        "Reference availability transfers no authority, permission, owner acceptance, production proof, or CANON status.",
        "Consequential high-risk memory behavior still requires representative human and specialist review."
    ],
}
(ROOT / "catalog.json").write_text(
    json.dumps(catalog, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
    encoding="utf-8",
)
print(json.dumps(catalog["counts"], sort_keys=True))
