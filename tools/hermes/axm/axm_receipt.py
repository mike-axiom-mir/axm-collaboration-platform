#!/usr/bin/env python3
"""Write metadata-only Hermes tool receipts for AXM review.

Raw arguments, tool results, user content, paths, and identifiers are not stored.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any

MODULE_ROOT = Path(os.environ.get("AXM_HERMES_ROOT", Path(__file__).resolve().parents[1])).resolve()
POLICY_FILE = Path(os.environ.get("AXM_HERMES_POLICY_FILE", MODULE_ROOT / "runtime" / "policy.json")).resolve()
RECEIPT_DIR = Path(os.environ.get("AXM_HERMES_RECEIPT_DIR", MODULE_ROOT / "runtime" / "receipts")).resolve()


def digest(value: Any) -> str:
    return hashlib.sha256(str(value or "").encode("utf-8", "replace")).hexdigest()[:16]


def load_event() -> dict[str, Any]:
    try:
        value = json.loads(sys.stdin.read() or "{}")
        return value if isinstance(value, dict) else {}
    except Exception:
        return {}


def receipts_enabled() -> bool:
    try:
        policy = json.loads(POLICY_FILE.read_text(encoding="utf-8"))
        return policy.get("consent", {}).get("enabled") is True and policy.get("receipts", {}).get("enabled") is True
    except Exception:
        return False


def main() -> None:
    if not receipts_enabled():
        print("{}")
        return
    event = load_event()
    session_hash = digest(event.get("session_id") or event.get("task_id") or "unknown")
    record = {
        "schema": "axm.hermes-tool-receipt/v1",
        "timestamp_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "session_hash": session_hash,
        "turn_hash": digest(event.get("turn_id")),
        "tool_call_hash": digest(event.get("tool_call_id")),
        "tool_name": str(event.get("tool_name") or event.get("tool") or "unknown")[:120],
        "status": str(event.get("status") or "unknown")[:80],
        "duration_ms": event.get("duration_ms") if isinstance(event.get("duration_ms"), (int, float)) else None,
        "error_type": str(event.get("error_type") or "")[:120] or None,
        "raw_arguments_stored": False,
        "raw_result_stored": False,
        "canon": False,
        "review_required": True,
    }
    RECEIPT_DIR.mkdir(parents=True, exist_ok=True)
    target = RECEIPT_DIR / f"{session_hash}.jsonl"
    with target.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, sort_keys=True, ensure_ascii=False) + "\n")
    print("{}")


if __name__ == "__main__":
    main()
