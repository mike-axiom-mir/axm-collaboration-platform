#!/usr/bin/env python3
"""Write metadata-only provider request receipts from Hermes API hooks."""
from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(os.environ.get("AXM_HERMES_ROOT", Path(__file__).resolve().parents[1])).resolve()
POLICY_FILE = Path(os.environ.get("AXM_HERMES_POLICY_FILE", ROOT / "runtime" / "policy.json")).resolve()
RUN_ID = os.environ.get("AXM_HERMES_RUN_ID", "unknown-run")
OUT_DIR = Path(os.environ.get("AXM_HERMES_PROVIDER_RECEIPT_DIR", ROOT / "runtime" / "provider-receipts")).resolve()
LOOPBACK = {"127.0.0.1", "localhost", "::1"}


def digest(value: object) -> str:
    return hashlib.sha256(str(value or "").encode("utf-8", "replace")).hexdigest()[:16]


def scope(base_url: object) -> str:
    if not base_url:
        return "unknown"
    try:
        parsed = urlparse(str(base_url))
        host = (parsed.hostname or "").lower()
        if not host:
            return "unknown"
        return "loopback" if host in LOOPBACK else "remote"
    except Exception:
        return "unknown"


def policy_state() -> tuple[str, bool]:
    try:
        value = json.loads(POLICY_FILE.read_text(encoding="utf-8"))
        return (
            str(value.get("provider_egress", {}).get("mode") or "unknown"),
            value.get("receipts", {}).get("record_provider_metadata") is True,
        )
    except Exception:
        return ("unknown", False)


def main() -> None:
    mode, enabled = policy_state()
    if not enabled:
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
    hook = str(event.get("hook_event_name") or "unknown")
    base_url = extra.get("base_url")
    base_scope = scope(base_url)
    host = ""
    try:
        host = urlparse(str(base_url or "")).hostname or ""
    except Exception:
        pass
    record = {
        "schema": "axm.hermes-provider-receipt/v1",
        "run_id": RUN_ID,
        "event": hook,
        "timestamp_ns": time.time_ns(),
        "session_hash": digest(event.get("session_id")),
        "turn_hash": digest(extra.get("turn_id")),
        "api_request_hash": digest(extra.get("api_request_id")),
        "provider": str(extra.get("provider") or "unknown")[:120],
        "model": str(extra.get("model") or extra.get("response_model") or "unknown")[:200],
        "api_mode": str(extra.get("api_mode") or "unknown")[:80],
        "base_url_scope": base_scope,
        "base_url_host_hash": digest(host) if host else None,
        "api_call_count": extra.get("api_call_count") if isinstance(extra.get("api_call_count"), int) else None,
        "retry_count": extra.get("retry_count") if isinstance(extra.get("retry_count"), int) else None,
        "message_count": extra.get("message_count") if isinstance(extra.get("message_count"), int) else None,
        "tool_count": extra.get("tool_count") if isinstance(extra.get("tool_count"), int) else None,
        "approx_input_tokens": extra.get("approx_input_tokens") if isinstance(extra.get("approx_input_tokens"), int) else None,
        "api_duration": extra.get("api_duration") if isinstance(extra.get("api_duration"), (int, float)) else None,
        "finish_reason": str(extra.get("finish_reason") or "")[:80] or None,
        "status_code": extra.get("status_code") if isinstance(extra.get("status_code"), int) else None,
        "retryable": extra.get("retryable") if isinstance(extra.get("retryable"), bool) else None,
        "provider_egress_mode": mode,
        "policy_mismatch": mode == "local_only" and base_scope == "remote",
        "raw_request_stored": False,
        "raw_response_stored": False,
        "canon": False,
    }
    canonical = json.dumps(record, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    record["receipt_hash"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{record['timestamp_ns']}-{record['api_request_hash']}-{digest(hook)}.json"
    (OUT_DIR / name).write_text(json.dumps(record, sort_keys=True, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("{}")


if __name__ == "__main__":
    main()
