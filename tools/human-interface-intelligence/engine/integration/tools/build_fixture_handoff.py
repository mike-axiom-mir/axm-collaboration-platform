from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "shared-contract" / "fixtures"
OUTPUT = ROOT / "integration" / "examples" / "shared_fixture_handoff_batch.json"


def main() -> int:
    records = []
    for path in sorted(FIXTURES.glob("*.json")):
        fixture = json.loads(path.read_text(encoding="utf-8"))
        capability = fixture["shared_capability_record"]
        source = capability["source_reference"]
        records.append({
            "item_id": fixture["fixture_id"],
            "capability": capability,
            "context": fixture["recommendation_context"],
            "expected": fixture["expected"],
            "immutable_source": {
                "capability_id": capability["capability_id"],
                "capability_revision": capability["capability_revision"],
                "source_location": source["source_location"],
                "source_hash": source["source_hash"]
            },
            "notes": [
                "Generated from the shared v0.1.0 fixture set.",
                "The real Human Capability Atlas was not executed to produce this packet."
            ]
        })
    batch = {
        "handoff_id": "axm.hii.shared-fixture-handoff.v0.2.0",
        "handoff_version": "0.2.0",
        "contract_id": "axm.capability-interface-contract",
        "contract_version": "0.1.0",
        "producer": {
            "module_id": "axm.human-capability-atlas.fixture-surrogate",
            "module_version": "not-executed",
            "execution_state": "NOT_RUN"
        },
        "generated_at": "2026-08-05T00:00:00Z",
        "records": records
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(batch, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
