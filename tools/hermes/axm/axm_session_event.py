#!/usr/bin/env python3
"""Capture content-free Hermes session lifecycle evidence for AXM runs."""
from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path

ROOT = Path(os.environ.get("AXM_HERMES_ROOT", Path(__file__).resolve().parents[1])).resolve()
POLICY_FILE = Path(os.environ.get("AXM_HERMES_POLICY_FILE", ROOT / "runtime" / "policy.json")).resolve()
RUN_ID = os.environ.get("AXM_HERMES_RUN_ID", "unknown-run")
OUT_DIR = Path(os.environ.get("AXM_HERMES_SESSION_EVENT_DIR", ROOT / "runtime" / "session-events")).resolve()


def digest(value: object) -> str:
    return hashlib.sha256(str(value or "").encode("utf-8", "replace")).hexdigest()[:16]


def enabled() -> bool:
    try:
        policy = json.loads(POLICY_FILE.read_text(encoding="utf-8"))
        return policy.get("receipts", {}).get("record_session_outcome_metadata") is True
    except Exception:
        return False


def main() -> None:
    if not enabled():
        print("{}")
        return
    try:
        event = json.loads(__import__("sys").stdin.read() or "{}")
    except Exception:
        print("{}")
        return
    if not isinstance(event, dict):
        print("{}")
        return
    extra = event.get("extra") if isinstance(event.get("extra"), dict) else {}
    record = {
        "schema": "axm.hermes-session-event/v1",
        "run_id": RUN_ID,
        "event": str(event.get("hook_event_name") or "unknown")[:80],
        "timestamp_ns": time.time_ns(),
        "session_hash": digest(event.get("session_id") or extra.get("old_session_id")),
        "turn_hash": digest(extra.get("turn_id")),
        "completed": extra.get("completed") if isinstance(extra.get("completed"), bool) else None,
        "failed": extra.get("failed") if isinstance(extra.get("failed"), bool) else None,
        "interrupted": extra.get("interrupted") if isinstance(extra.get("interrupted"), bool) else None,
        "turn_exit_reason": str(extra.get("turn_exit_reason") or extra.get("reason") or "")[:120] or None,
        "model": str(extra.get("model") or "unknown")[:200],
        "platform": str(extra.get("platform") or "unknown")[:80],
        "raw_message_stored": False,
        "canon": False,
    }
    canonical = json.dumps(record, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    record["receipt_hash"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{record['timestamp_ns']}-{record['session_hash']}-{digest(record['event'])}.json"
    (OUT_DIR / name).write_text(json.dumps(record, sort_keys=True, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("{}")


if __name__ == "__main__":
    main()
