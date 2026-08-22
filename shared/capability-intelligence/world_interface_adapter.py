#!/usr/bin/env python3
"""Bind curated interface-world signals to Workshop modules without authority leakage."""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
WORLD = HERE / "world-interface"
LATEST = HERE / "generated" / "world-interface" / "latest.json"


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def digest_value(value: Any) -> str:
    return "sha256:" + hashlib.sha256(_canonical_bytes(value)).hexdigest()


def load_world_state(latest_path: Path = LATEST) -> dict[str, Any]:
    sources = json.loads((WORLD / "sources.json").read_text(encoding="utf-8"))
    signals = json.loads((WORLD / "signals.json").read_text(encoding="utf-8"))
    if latest_path.exists():
        latest = json.loads(latest_path.read_text(encoding="utf-8"))
    else:
        latest = {
            "schema": "axm.interface-world-latest/v1",
            "generated_at": None,
            "observations": {},
            "summary": {"sources": len(sources["sources"]), "tracked": 0, "review_required": 0, "unavailable": len(sources["sources"])},
            "truth": {"network_sync_completed": False, "raw_source_content_retained": False},
        }
    return {"sources": sources, "signals": signals, "latest": latest}


def _manifest_text(manifest: dict[str, Any]) -> str:
    values = [
        manifest.get("id", ""),
        manifest.get("name", ""),
        manifest.get("summary", ""),
        manifest.get("notes", ""),
        " ".join(str(value) for value in manifest.get("tags", []) if value is not None),
        " ".join(str(value) for value in manifest.get("uses", []) if value is not None),
        " ".join(str(value) for value in manifest.get("actions", []) if value is not None),
    ]
    return " ".join(str(value) for value in values).lower()


def _has_context_tag(haystack: str, tag: str) -> bool:
    parts = [re.escape(part) for part in re.split(r"[^a-z0-9]+", tag.lower()) if part]
    if not parts:
        return False
    pattern = r"(?<![a-z0-9])" + r"[^a-z0-9]+".join(parts) + r"(?![a-z0-9])"
    return re.search(pattern, haystack) is not None


def world_context_for_module(
    manifest: dict[str, Any],
    interface_pattern_id: str,
    world_state: dict[str, Any],
) -> dict[str, Any]:
    source_rows = {row["source_id"]: row for row in world_state["sources"]["sources"]}
    observations = world_state["latest"].get("observations", {})
    haystack = _manifest_text(manifest)
    admitted: list[dict[str, Any]] = []
    contextual_held: list[str] = []

    for signal in world_state["signals"]["signals"]:
        source = source_rows[signal["source_id"]]
        patterns = signal.get("pattern_ids", [])
        pattern_match = "*" in patterns or interface_pattern_id in patterns
        if not pattern_match:
            continue
        if source["applicability_gate"] == "CONTEXT_REQUIRED":
            tags = source.get("context_tags", [])
            if not any(_has_context_tag(haystack, tag) for tag in tags):
                contextual_held.append(signal["signal_id"])
                continue
        observation = observations.get(source["source_id"], {})
        admitted.append({
            "signal_id": signal["signal_id"],
            "source_id": source["source_id"],
            "source_title": source["title"],
            "source_url": source["url"],
            "source_class": source["source_class"],
            "priority": signal["priority"],
            "statement": signal["statement"],
            "fit_check": signal["fit_check"],
            "source_tracking_state": observation.get("tracking_state", "NOT_SYNCED"),
            "source_content_sha256": observation.get("content_sha256"),
        })

    change_sources = sorted({row["source_id"] for row in admitted if row["source_tracking_state"] == "CHANGE_DETECTED_REVIEW_REQUIRED"})
    unavailable_sources = sorted({row["source_id"] for row in admitted if row["source_tracking_state"] in {"NOT_SYNCED", "SOURCE_UNAVAILABLE"}})
    if change_sources:
        state = "REVIEW_REQUIRED"
    elif unavailable_sources:
        state = "FRESHNESS_UNKNOWN"
    else:
        state = "TRACKED"
    result = {
        "state": state,
        "applicable_signal_count": len(admitted),
        "applicable_source_count": len({row["source_id"] for row in admitted}),
        "applicable_signals": admitted,
        "change_source_ids": change_sources,
        "unavailable_source_ids": unavailable_sources,
        "contextual_signal_ids_held": sorted(set(contextual_held)),
        "last_checked_at": world_state["latest"].get("generated_at"),
        "truth": {
            "advisory_only": True,
            "compliance_proven": False,
            "interface_change_applied": False,
            "automatic_execution": False,
            "automatic_canon": False,
        },
    }
    result["world_context_sha256"] = digest_value(result)
    return result


def build_impact_map(items: list[dict[str, Any]], generated_at: str, latest: dict[str, Any]) -> dict[str, Any]:
    modules = []
    for item in items:
        context = item["module2"]["world_fit"]
        modules.append({
            "module_id": item["module_id"],
            "interface_pattern_id": item["module2"]["interface_pattern_id"],
            "world_fit_state": context["state"],
            "applicable_signal_count": context["applicable_signal_count"],
            "source_ids": sorted({row["source_id"] for row in context["applicable_signals"]}),
            "change_source_ids": context["change_source_ids"],
            "world_context_sha256": context["world_context_sha256"],
        })
    counts = Counter(row["world_fit_state"] for row in modules)
    result = {
        "schema": "axm.interface-world-module-impact-map/v1",
        "generated_at": generated_at,
        "source_snapshot_generated_at": latest.get("generated_at"),
        "source_snapshot_sha256": latest.get("latest_sha256"),
        "summary": {"modules": len(modules), "states": dict(sorted(counts.items()))},
        "modules": modules,
        "truth": {"derived_view": True, "module_interfaces_rewritten": False, "authority_granted": False},
    }
    result["impact_map_sha256"] = digest_value(result)
    return result
