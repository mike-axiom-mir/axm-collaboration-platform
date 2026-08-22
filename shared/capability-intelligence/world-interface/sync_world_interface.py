#!/usr/bin/env python3
"""Observe trusted interface sources and retain only bounded change evidence.

Raw page bodies are used transiently to compute normalized text digests. They
are never retained. Repeated unchanged checks are aggregated; only baseline,
change, availability-transition, and explicit acknowledgement events enter the
append-only chain.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import ssl
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Callable


HERE = Path(__file__).resolve().parent
SHARED = HERE.parent
DEFAULT_OUTPUT = SHARED / "generated" / "world-interface"
SOURCE_REGISTRY = HERE / "sources.json"
MAX_SOURCE_BYTES = 12 * 1024 * 1024
USER_AGENT = "AXM-Interface-World-Signals/0.1 (+local advisory tracker)"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def digest_value(value: Any) -> str:
    return "sha256:" + hashlib.sha256(canonical_bytes(value)).hexdigest()


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    temporary.replace(path)


def read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


class VisibleTextParser(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "template"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in self.SKIP:
            self.depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in self.SKIP and self.depth:
            self.depth -= 1

    def handle_data(self, data: str) -> None:
        if not self.depth:
            text = " ".join(data.split())
            if text:
                self.parts.append(text)

    def normalized(self) -> str:
        return " ".join(" ".join(self.parts).split())


def normalize_body(body: bytes, content_type: str) -> str:
    charset = "utf-8"
    for part in content_type.split(";")[1:]:
        key, _, value = part.strip().partition("=")
        if key.lower() == "charset" and value:
            charset = value.strip(" \"'")
    text = body.decode(charset, errors="replace")
    if "html" not in content_type.lower():
        return " ".join(text.split())
    parser = VisibleTextParser()
    parser.feed(text)
    parser.close()
    return parser.normalized()


def fetch_source(source: dict[str, Any], timeout: float = 20.0) -> dict[str, Any]:
    request = urllib.request.Request(
        source["url"],
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,text/plain;q=0.9"},
        method="GET",
    )
    context = ssl.create_default_context()
    with urllib.request.urlopen(request, timeout=timeout, context=context) as response:
        content_type = str(response.headers.get("Content-Type") or "")
        if not ("text/html" in content_type.lower() or "text/plain" in content_type.lower()):
            raise ValueError("unsupported content type: " + (content_type or "missing"))
        body = response.read(MAX_SOURCE_BYTES + 1)
        if len(body) > MAX_SOURCE_BYTES:
            raise ValueError(f"source exceeds {MAX_SOURCE_BYTES} byte observation limit")
        normalized = normalize_body(body, content_type)
        observation_mode = str(source.get("observation_mode") or "NORMALIZED_VISIBLE_TEXT")
        if len(normalized) < 100 and observation_mode != "DOCUMENT_BYTES":
            raise ValueError("normalized source text is unexpectedly short")
        digest_input = body if observation_mode == "DOCUMENT_BYTES" else normalized.encode("utf-8")
        return {
            "http_status": int(getattr(response, "status", 200)),
            "content_type": content_type,
            "content_bytes": len(body),
            "normalized_characters": len(normalized),
            "content_sha256": "sha256:" + hashlib.sha256(digest_input).hexdigest(),
            "observation_mode": observation_mode,
            "etag": response.headers.get("ETag"),
            "last_modified": response.headers.get("Last-Modified"),
            "final_url": response.geturl(),
        }


def load_events(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    events = []
    previous = None
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        event = json.loads(line)
        declared = event.get("event_sha256")
        actual = digest_value({key: value for key, value in event.items() if key != "event_sha256"})
        if declared != actual or event.get("previous_event_sha256") != previous:
            raise ValueError(f"event chain integrity failure at line {number}")
        previous = declared
        events.append(event)
    return events


def append_event(path: Path, events: list[dict[str, Any]], event: dict[str, Any]) -> dict[str, Any]:
    row = {
        "schema": "axm.interface-world-change-event/v1",
        "previous_event_sha256": events[-1]["event_sha256"] if events else None,
        **event,
    }
    row["event_sha256"] = digest_value(row)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(row, sort_keys=True, ensure_ascii=False) + "\n")
    events.append(row)
    return row


def _error_text(error: Exception) -> str:
    if isinstance(error, urllib.error.HTTPError):
        return f"HTTP {error.code}"
    if isinstance(error, urllib.error.URLError):
        return "network unavailable: " + str(error.reason)[:240]
    return str(error)[:260]


def synchronize(
    output: Path = DEFAULT_OUTPUT,
    *,
    fetcher: Callable[[dict[str, Any]], dict[str, Any]] = fetch_source,
    checked_at: str | None = None,
) -> dict[str, Any]:
    timestamp = checked_at or utc_now()
    registry = json.loads(SOURCE_REGISTRY.read_text(encoding="utf-8"))
    registry_sha = digest_value(registry)
    latest_path = output / "latest.json"
    summary_path = output / "check-summary.json"
    events_path = output / "change-events.jsonl"
    previous_latest = read_json(latest_path, {"observations": {}})
    previous_observations = previous_latest.get("observations", {})
    aggregate = read_json(summary_path, {"schema": "axm.interface-world-check-summary/v1", "sources": {}})
    events = load_events(events_path)
    observations: dict[str, Any] = {}

    for source in registry["sources"]:
        source_id = source["source_id"]
        previous = previous_observations.get(source_id, {})
        stats = aggregate.setdefault("sources", {}).setdefault(source_id, {
            "checks": 0,
            "unchanged_checks": 0,
            "change_events": 0,
            "failure_checks": 0,
            "availability_transitions": 0,
            "first_checked_at": timestamp,
        })
        stats["checks"] += 1
        stats["last_checked_at"] = timestamp
        try:
            observed = fetcher(source)
            content_sha = observed["content_sha256"]
            previous_content = previous.get("content_sha256")
            comparison_sha = previous.get("comparison_sha256") or previous_content or content_sha
            if not previous_content:
                append_event(events_path, events, {
                    "event_type": "BASELINE_OBSERVED",
                    "source_id": source_id,
                    "observed_at": timestamp,
                    "current_content_sha256": content_sha,
                    "previous_content_sha256": None,
                    "authority": "ADVISORY_TEST_BASELINE",
                })
            elif previous.get("availability") != "AVAILABLE":
                stats["availability_transitions"] += 1
                append_event(events_path, events, {
                    "event_type": "SOURCE_RECOVERED",
                    "source_id": source_id,
                    "observed_at": timestamp,
                    "current_content_sha256": content_sha,
                    "previous_content_sha256": previous_content,
                    "authority": "OBSERVATION_ONLY",
                })
            elif previous_content != content_sha:
                stats["change_events"] += 1
                append_event(events_path, events, {
                    "event_type": "CONTENT_CHANGED",
                    "source_id": source_id,
                    "observed_at": timestamp,
                    "current_content_sha256": content_sha,
                    "previous_content_sha256": previous_content,
                    "comparison_content_sha256": comparison_sha,
                    "authority": "HUMAN_REVIEW_REQUIRED",
                })
            else:
                stats["unchanged_checks"] += 1
            tracking_state = "CHANGE_DETECTED_REVIEW_REQUIRED" if content_sha != comparison_sha else "TRACKED"
            observations[source_id] = {
                "source_id": source_id,
                "title": source["title"],
                "publisher": source["publisher"],
                "url": source["url"],
                "source_class": source["source_class"],
                "applicability_gate": source["applicability_gate"],
                "availability": "AVAILABLE",
                "tracking_state": tracking_state,
                "observed_at": timestamp,
                "comparison_sha256": comparison_sha,
                **observed,
                "error": None,
            }
            stats["last_status"] = tracking_state
        except Exception as error:  # every source failure remains visible without blocking other sources
            stats["failure_checks"] += 1
            if previous.get("availability") != "UNAVAILABLE":
                stats["availability_transitions"] += 1
                append_event(events_path, events, {
                    "event_type": "SOURCE_UNAVAILABLE",
                    "source_id": source_id,
                    "observed_at": timestamp,
                    "current_content_sha256": previous.get("content_sha256"),
                    "previous_content_sha256": previous.get("content_sha256"),
                    "error": _error_text(error),
                    "authority": "FRESHNESS_UNKNOWN",
                })
            observations[source_id] = {
                "source_id": source_id,
                "title": source["title"],
                "publisher": source["publisher"],
                "url": source["url"],
                "source_class": source["source_class"],
                "applicability_gate": source["applicability_gate"],
                "availability": "UNAVAILABLE",
                "tracking_state": "SOURCE_UNAVAILABLE",
                "observed_at": timestamp,
                "comparison_sha256": previous.get("comparison_sha256"),
                "content_sha256": previous.get("content_sha256"),
                "http_status": None,
                "content_type": None,
                "content_bytes": None,
                "normalized_characters": None,
                "etag": None,
                "last_modified": None,
                "final_url": None,
                "error": _error_text(error),
            }
            stats["last_status"] = "SOURCE_UNAVAILABLE"

    state_counts: dict[str, int] = {}
    for row in observations.values():
        state_counts[row["tracking_state"]] = state_counts.get(row["tracking_state"], 0) + 1
    latest = {
        "schema": "axm.interface-world-latest/v1",
        "generated_at": timestamp,
        "registry_sha256": registry_sha,
        "observations": observations,
        "summary": {
            "sources": len(observations),
            "states": dict(sorted(state_counts.items())),
            "change_events": sum(1 for event in events if event["event_type"] == "CONTENT_CHANGED"),
            "event_chain_head": events[-1]["event_sha256"] if events else None,
        },
        "truth": {
            "network_sync_completed": True,
            "raw_source_content_retained": False,
            "unchanged_checks_aggregated": True,
            "source_change_means_interface_change": False,
            "human_review_required_before_adoption": True,
            "automatic_interface_rewrite": False,
            "automatic_canon": False,
        },
    }
    latest["latest_sha256"] = digest_value(latest)
    aggregate["generated_at"] = timestamp
    aggregate["event_chain_head"] = latest["summary"]["event_chain_head"]
    aggregate["truth"] = {"derived_aggregate": True, "durable_changes_live_in": "change-events.jsonl"}
    aggregate["summary_sha256"] = digest_value({key: value for key, value in aggregate.items() if key != "summary_sha256"})
    write_json(latest_path, latest)
    write_json(summary_path, aggregate)
    return latest


def acknowledge(output: Path, source_id: str, reviewer: str, note: str, acknowledged_at: str | None = None) -> dict[str, Any]:
    if not reviewer.strip() or not note.strip():
        raise ValueError("acknowledgement requires a reviewer and a review note")
    timestamp = acknowledged_at or utc_now()
    latest_path = output / "latest.json"
    events_path = output / "change-events.jsonl"
    latest = read_json(latest_path, None)
    if not latest or source_id not in latest.get("observations", {}):
        raise ValueError("source has no observed state: " + source_id)
    observation = latest["observations"][source_id]
    if observation.get("availability") != "AVAILABLE" or not observation.get("content_sha256"):
        raise ValueError("source is not currently available: " + source_id)
    events = load_events(events_path)
    append_event(events_path, events, {
        "event_type": "ADVISORY_BASELINE_ACKNOWLEDGED",
        "source_id": source_id,
        "observed_at": timestamp,
        "current_content_sha256": observation["content_sha256"],
        "previous_content_sha256": observation.get("comparison_sha256"),
        "reviewer": reviewer.strip(),
        "review_note": note.strip(),
        "authority": "SOURCE_BASELINE_ONLY_NO_MODULE_CHANGE",
    })
    observation["comparison_sha256"] = observation["content_sha256"]
    observation["tracking_state"] = "TRACKED"
    observation["acknowledged_at"] = timestamp
    observation["acknowledged_by"] = reviewer.strip()
    latest["generated_at"] = timestamp
    counts: dict[str, int] = {}
    for row in latest["observations"].values():
        counts[row["tracking_state"]] = counts.get(row["tracking_state"], 0) + 1
    latest["summary"]["states"] = dict(sorted(counts.items()))
    latest["summary"]["event_chain_head"] = events[-1]["event_sha256"]
    latest["latest_sha256"] = digest_value({key: value for key, value in latest.items() if key != "latest_sha256"})
    write_json(latest_path, latest)
    return latest


def main() -> int:
    parser = argparse.ArgumentParser(description="Track official interface guidance without applying it automatically")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--acknowledge")
    parser.add_argument("--reviewer")
    parser.add_argument("--note")
    args = parser.parse_args()
    try:
        if args.acknowledge:
            latest = acknowledge(args.output, args.acknowledge, args.reviewer or "", args.note or "")
        else:
            latest = synchronize(args.output, fetcher=lambda source: fetch_source(source, args.timeout))
        print(json.dumps({
            "status": "PASS",
            "sources": latest["summary"]["sources"],
            "states": latest["summary"]["states"],
            "event_chain_head": latest["summary"]["event_chain_head"],
            "latest_sha256": latest["latest_sha256"],
            "output": str(args.output),
        }, indent=2, ensure_ascii=False))
        return 0
    except Exception as error:
        print(json.dumps({"status": "FAIL", "error": str(error)}, indent=2, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
