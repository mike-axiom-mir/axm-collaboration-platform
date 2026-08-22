#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
SHARED = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(SHARED))

from sync_world_interface import acknowledge, load_events, synchronize  # noqa: E402
from world_interface_adapter import load_world_state, world_context_for_module  # noqa: E402


def main() -> int:
    checks: dict[str, bool] = {}
    registry = json.loads((HERE / "sources.json").read_text(encoding="utf-8"))
    signals = json.loads((HERE / "signals.json").read_text(encoding="utf-8"))
    checks["eight_trusted_sources"] = len(registry["sources"]) == 8
    checks["source_classes_separated"] = {row["source_class"] for row in registry["sources"]} >= {"NORMATIVE_STANDARD", "IMPLEMENTATION_GUIDANCE", "ECOSYSTEM_GUIDANCE"}
    checks["signals_are_advisory"] = "advisory" in signals["truth_boundary"].lower() and len(signals["signals"]) >= 10

    round_number = {source["source_id"]: 0 for source in registry["sources"]}

    def fake_fetch(source: dict[str, object]) -> dict[str, object]:
        source_id = str(source["source_id"])
        value = round_number[source_id]
        return {
            "http_status": 200,
            "content_type": "text/html; charset=utf-8",
            "content_bytes": 120,
            "normalized_characters": 100,
            "content_sha256": "sha256:" + ("a" if value == 0 else "b") * 64,
            "etag": None,
            "last_modified": None,
            "final_url": str(source["url"]),
        }

    with tempfile.TemporaryDirectory(prefix="axm-interface-world-") as name:
        output = Path(name)
        first = synchronize(output, fetcher=fake_fetch, checked_at="2026-08-09T01:00:00Z")
        events_after_first = load_events(output / "change-events.jsonl")
        second = synchronize(output, fetcher=fake_fetch, checked_at="2026-08-09T02:00:00Z")
        events_after_second = load_events(output / "change-events.jsonl")
        changed_id = registry["sources"][0]["source_id"]
        round_number[changed_id] = 1
        third = synchronize(output, fetcher=fake_fetch, checked_at="2026-08-09T03:00:00Z")
        events_after_third = load_events(output / "change-events.jsonl")
        acknowledged = acknowledge(output, changed_id, "fixture-reviewer", "Reviewed fixture source change.", "2026-08-09T04:00:00Z")
        events_after_ack = load_events(output / "change-events.jsonl")

        checks["baseline_event_per_source"] = len(events_after_first) == 8 and all(row["event_type"] == "BASELINE_OBSERVED" for row in events_after_first)
        checks["unchanged_checks_aggregated"] = len(events_after_second) == len(events_after_first) and second["truth"]["unchanged_checks_aggregated"]
        checks["one_changed_source_retained"] = len(events_after_third) == len(events_after_second) + 1 and third["observations"][changed_id]["tracking_state"] == "CHANGE_DETECTED_REVIEW_REQUIRED"
        checks["explicit_acknowledgement_closes_source_review"] = acknowledged["observations"][changed_id]["tracking_state"] == "TRACKED" and events_after_ack[-1]["event_type"] == "ADVISORY_BASELINE_ACKNOWLEDGED"
        checks["raw_content_not_retained"] = first["truth"]["raw_source_content_retained"] is False

        world = load_world_state(output / "latest.json")
        generic = world_context_for_module({"id": "fixture", "name": "Fixture", "summary": "A generic web tool"}, "guided_form", world)
        android = world_context_for_module({"id": "android-fixture", "name": "Android Fixture", "summary": "A Material Android tool"}, "guided_form", world)
        checks["universal_sources_apply"] = generic["applicable_signal_count"] >= 4
        checks["contextual_sources_held"] = "world.material.adaptive-and-redundant-state" in generic["contextual_signal_ids_held"]
        checks["contextual_source_applies_when_declared"] = any(row["signal_id"] == "world.material.adaptive-and-redundant-state" for row in android["applicable_signals"])
        checks["module_authority_closed"] = all(value is False for key, value in generic["truth"].items() if key != "advisory_only") and generic["truth"]["advisory_only"] is True

    result = {"status": "PASS" if all(checks.values()) else "FAIL", "checks": checks}
    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
