#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
WORKSHOP = HERE.parents[1]
sys.path.insert(0, str(HERE))

from platform_usability import (  # noqa: E402
    DEFAULT_OUTPUT,
    MODULE1,
    MODULE2,
    MODULE3,
    build_catalog,
    digest_value,
    verify_existing,
)


def tree_digest(path: Path) -> str:
    rows = []
    for item in sorted(path.rglob("*")):
        if not item.is_file() or "__pycache__" in item.parts or item.suffix in {".pyc", ".pyo"}:
            continue
        rows.append({
            "path": item.relative_to(path).as_posix(),
            "bytes": item.stat().st_size,
            "sha256": __import__("hashlib").sha256(item.read_bytes()).hexdigest(),
        })
    return digest_value(rows)


def main() -> int:
    checks: dict[str, bool] = {}
    existing = verify_existing(DEFAULT_OUTPUT)
    checks["existing_catalog"] = existing["status"] == "PASS"

    before = {name: tree_digest(path) for name, path in (("module1", MODULE1), ("module2", MODULE2), ("module3", MODULE3))}
    with tempfile.TemporaryDirectory(prefix="axm-platform-usability-") as first_name, tempfile.TemporaryDirectory(prefix="axm-platform-usability-") as second_name:
        first = Path(first_name)
        second = Path(second_name)
        first_receipt = build_catalog(first)
        second_receipt = build_catalog(second)
        first_catalog = json.loads((first / "catalog.json").read_text(encoding="utf-8"))
        second_catalog = json.loads((second / "catalog.json").read_text(encoding="utf-8"))
        checks["deterministic_catalog"] = first_catalog["catalog_sha256"] == second_catalog["catalog_sha256"] == existing["catalog_sha256"]
        checks["deterministic_receipt"] = first_receipt["receipt_sha256"] == second_receipt["receipt_sha256"] == existing["receipt_sha256"]
        checks["all_registered_modules"] = first_receipt["coverage"]["registered_id_count"] == first_receipt["coverage"]["completed_id_count"] == 214
        checks["all_declared_capabilities_bound"] = first_receipt["coverage"]["declared_capability_count"] == 1826
        checks["all_bridge_digests_match"] = all(row["module1_to_module2_digest_match"] for row in first_receipt["records"])
        checks["module3_authority_closed"] = first_receipt["module_chain"]["module3"]["authority_remains_closed"]
        checks["module3_one_signal_per_module"] = first_receipt["module_chain"]["module3"]["signals"] == 214
        checks["world_sources_tracked"] = first_receipt["module_chain"]["interface_world"]["sources"] == 8 and first_receipt["module_chain"]["interface_world"]["source_states"] == {"TRACKED": 8}
        checks["world_fit_bound_to_every_module"] = first_receipt["module_chain"]["interface_world"]["module_fit_states"] == {"TRACKED": 214}
        checks["world_changes_do_not_auto_apply"] = first_receipt["truth"]["external_source_changes_are_automatically_applied"] is False
        patterns = first_receipt["module_chain"]["module2"]["patterns"]
        checks["representative_patterns_exercised"] = sum(1 for count in patterns.values() if count) >= 8
        checks["unknown_risk_held"] = first_receipt["module_chain"]["module2"]["recommendation_statuses"].get("insufficient_information", 0) > 0
        checks["review_gaps_retained"] = first_receipt["module_chain"]["module3"]["gap_states"].get("REVIEW_REQUIRED", 0) > 0
        checks["ready_guidance_retained"] = first_receipt["module_chain"]["module3"]["gap_states"].get("GUIDANCE_READY", 0) > 0

    after = {name: tree_digest(path) for name, path in (("module1", MODULE1), ("module2", MODULE2), ("module3", MODULE3))}
    checks["supplier_engines_unchanged"] = before == after
    result = {
        "status": "PASS" if all(checks.values()) else "FAIL",
        "checks": checks,
        "catalog_sha256": existing["catalog_sha256"],
        "receipt_sha256": existing["receipt_sha256"],
    }
    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
