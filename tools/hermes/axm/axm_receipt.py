#!/usr/bin/env python3
"""Write metadata-only Hermes tool receipts for AXM review.

Evidence recording is controlled by receipts.enabled, not current action
consent. If consent is revoked while an already-authorized tool is finishing,
AXM still records the completion metadata instead of losing the audit edge.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

MODULE_ROOT = Path(os.environ.get("AXM_HERMES_ROOT", Path(__file__).resolve().parents[1])).resolve()
POLICY_FILE = Path(os.environ.get("AXM_HERMES_POLICY_FILE", MODULE_ROOT / "runtime" / "policy.json")).resolve()
RECEIPT_DIR = Path(os.environ.get("AXM_HERMES_RECEIPT_DIR", MODULE_ROOT / "runtime" / "receipts")).resolve()
RUN_ID = os.environ.get("AXM_HERMES_RUN_ID", "unknown-run")


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
        return policy.get("receipts", {}).get("enabled") is True
    except Exception:
        return False


def main() -> None:
    if not receipts_enabled():
        print("{}")
        return
    event = load_event()
    extra = event.get("extra") if isinstance(event.get("extra"), dict) else {}
    timestamp_ns = time.time_ns()
    record = {
        "schema": "axm.hermes-tool-receipt/v1",
        "run_id": RUN_ID,
        "timestamp_ns": timestamp_ns,
        "session_hash": digest(event.get("session_id")),
        "turn_hash": digest(extra.get("turn_id")),
        "tool_call_hash": digest(extra.get("tool_call_id")),
        "tool_name": str(event.get("tool_name") or "unknown")[:120],
        "status": str(extra.get("status") or "unknown")[:80],
        "duration_ms": extra.get("duration_ms") if isinstance(extra.get("duration_ms"), (int, float)) else None,
        "error_type": str(extra.get("error_type") or "")[:120] or None,
        "raw_arguments_stored": False,
        "raw_result_stored": False,
        "raw_paths_stored": False,
        "canon": False,
        "review_required": True,
    }
    canonical = json.dumps(record, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    record["receipt_hash"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    RECEIPT_DIR.mkdir(parents=True, exist_ok=True)
    target = RECEIPT_DIR / f"{timestamp_ns}-{record['tool_call_hash']}-{digest(record['tool_name'])}.json"
    target.write_text(json.dumps(record, sort_keys=True, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("{}")


if __name__ == "__main__":
    main()
