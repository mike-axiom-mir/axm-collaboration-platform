#!/usr/bin/env python3
"""Build the durable one-by-one human-usability stewardship queue.

The catalog supplies ordering context only. A module remains PENDING until a
separate evidence-backed result names its findings, changes, and verification.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


WORKSHOP = Path(__file__).resolve().parents[2]
CATALOG = WORKSHOP / "shared/capability-intelligence/generated/platform-usability/catalog.json"
WORLD_IMPACT = WORKSHOP / "shared/capability-intelligence/generated/platform-usability/world-interface-impact.json"
DEFAULT_OUTPUT = WORKSHOP / "docs/steward-runs/2026-08-09-module-by-module-usability"
FIRST_BATCH = [
    "human-capability-atlas",
    "human-interface-intelligence",
    "grounded-evolution-intelligence",
]
RISK_ORDER = {"unknown": 0, "high": 1, "moderate": 2, "low": 3}


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the AXM one-by-one module usability ledger")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--results", type=Path)
    args = parser.parse_args()

    catalog = load_json(CATALOG)
    world_impact = load_json(WORLD_IMPACT)
    items = catalog.get("items", [])
    if len(items) != catalog.get("coverage", {}).get("registered_modules"):
        raise SystemExit("catalog coverage mismatch; refusing to create a misleading audit queue")

    result_path = args.results or (args.output / "batch-001-results.json")
    results = load_json(result_path).get("results", {}) if result_path.exists() else {}
    by_id = {item["module_id"]: item for item in items}
    impact_by_id = {item["module_id"]: item for item in world_impact.get("modules", [])}
    if set(impact_by_id) != set(by_id):
        raise SystemExit("world-interface impact coverage mismatch; refusing to create a partial audit queue")
    missing = sorted(set(FIRST_BATCH) - set(by_id))
    if missing:
        raise SystemExit("first-batch module missing from catalog: " + ", ".join(missing))

    remaining = [item for item in items if item["module_id"] not in FIRST_BATCH]
    remaining.sort(key=lambda item: (
        0 if item["module3"]["gap_state"] == "REVIEW_REQUIRED" else 1,
        RISK_ORDER.get(item["risk"], 4),
        item["module_id"],
    ))
    ordered = [by_id[module_id] for module_id in FIRST_BATCH] + remaining

    records = []
    for position, item in enumerate(ordered, 1):
        result = results.get(item["module_id"], {})
        impact = impact_by_id[item["module_id"]]
        records.append({
            "position": position,
            "module_id": item["module_id"],
            "module_name": item["module_name"],
            "route": item["route"],
            "registry_status": item["status"],
            "risk": item["risk"],
            "module2_pattern": item["module2"]["interface_pattern_id"],
            "module2_assurance": item["module2"]["assurance_status"],
            "module3_gap_state": item["module3"]["gap_state"],
            "world_fit_state": impact["world_fit_state"],
            "world_fit_signal_count": impact["applicable_signal_count"],
            "world_context_sha256": impact["world_context_sha256"],
            "audit_state": result.get("audit_state", "PENDING"),
            "findings": result.get("findings", []),
            "changes": result.get("changes", []),
            "evidence": result.get("evidence", []),
            "checked_at": result.get("checked_at"),
            "truth_boundary": "A catalog recommendation does not prove the native interface. Only this module's retained audit evidence may advance audit_state.",
        })

    states = Counter(record["audit_state"] for record in records)
    ledger = {
        "schema": "axm.module-usability-steward-ledger/v1",
        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source_catalog_sha256": catalog["catalog_sha256"],
        "ordering_rule": "First integrate the three intelligence modules; then REVIEW_REQUIRED modules ordered by unknown, high, moderate, and low risk; then guidance-ready modules in the same risk order.",
        "total_modules": len(records),
        "summary": dict(sorted(states.items())),
        "world_interface": world_impact["summary"],
        "records": records,
    }
    write_json(args.output / "module-audit-ledger.json", ledger)

    lines = [
        "# AXM Module-by-Module Human-Usability Queue",
        "",
        f"Catalog: `{catalog['catalog_sha256']}`  ",
        f"Modules: **{len(records)}**  ",
        "",
        "A module stays `PENDING` until its own interface has been inspected, changed only where needed, and verified with module-native and live visual evidence.",
        "",
        "| # | Module | Risk | Module 3 state | Suggested pattern | World fit | Audit state |",
        "|---:|---|---|---|---|---|---|",
    ]
    for record in records:
        lines.append(
            f"| {record['position']} | {record['module_name']} (`{record['module_id']}`) | "
            f"{record['risk']} | {record['module3_gap_state']} | "
            f"{record['module2_pattern']} | {record['world_fit_state']} ({record['world_fit_signal_count']}) | {record['audit_state']} |"
        )
    (args.output / "MODULE_AUDIT_QUEUE.md").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"status": "PASS", "modules": len(records), "summary": ledger["summary"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
