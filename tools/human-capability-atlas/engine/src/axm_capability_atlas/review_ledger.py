from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from .io import loads_json
from typing import Any
import json
import uuid

_ALLOWED_EVENTS = {"correction_proposed", "dissent", "reviewed", "accepted", "rejected", "withdrawn"}


def _canonical(value: dict[str, Any]) -> bytes:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def _read_events(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    events = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            event = loads_json(line)
        except ValueError as exc:
            raise ValueError(f"Invalid review ledger JSON at line {line_no}: {exc}") from exc
        if not isinstance(event, dict):
            raise ValueError(f"Review ledger line {line_no} is not an object")
        events.append(event)
    return events


def append_event(
    path: str | Path,
    *,
    capability_id: str,
    event_type: str,
    actor: str,
    reason: str,
    field: str = "",
    proposed_value: Any = None,
    source_references: list[str] | None = None,
) -> dict[str, Any]:
    if event_type not in _ALLOWED_EVENTS:
        raise ValueError(f"Unsupported review event type: {event_type}")
    if not capability_id.strip() or not actor.strip() or not reason.strip():
        raise ValueError("capability_id, actor, and reason are required")
    ledger = Path(path)
    events = _read_events(ledger)
    previous_hash = events[-1].get("event_hash", "") if events else "GENESIS"
    event = {
        "sequence": len(events) + 1,
        "event_id": str(uuid.uuid4()),
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "capability_id": capability_id,
        "event_type": event_type,
        "actor": actor,
        "field": field,
        "proposed_value": proposed_value,
        "reason": reason,
        "source_references": source_references or [],
        "previous_hash": previous_hash,
    }
    event["event_hash"] = sha256(_canonical(event)).hexdigest()
    ledger.parent.mkdir(parents=True, exist_ok=True)
    with ledger.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")
    return event


def verify_ledger(path: str | Path) -> dict[str, Any]:
    ledger = Path(path)
    events = _read_events(ledger)
    errors: list[str] = []
    expected_previous = "GENESIS"
    for index, event in enumerate(events, start=1):
        if event.get("sequence") != index:
            errors.append(f"Sequence mismatch at line {index}: {event.get('sequence')!r}")
        if event.get("previous_hash") != expected_previous:
            errors.append(f"Previous-hash mismatch at line {index}")
        claimed = event.get("event_hash")
        body = dict(event)
        body.pop("event_hash", None)
        calculated = sha256(_canonical(body)).hexdigest()
        if claimed != calculated:
            errors.append(f"Event-hash mismatch at line {index}")
        expected_previous = str(claimed or "")
    return {
        "valid": not errors,
        "event_count": len(events),
        "last_hash": expected_previous if events else "GENESIS",
        "errors": errors,
        "important_note": "The hash chain detects ledger modification but does not prove the real-world identity of an actor.",
    }
