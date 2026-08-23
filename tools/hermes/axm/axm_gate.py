#!/usr/bin/env python3
"""AXM fail-closed pre-tool gate for Hermes.

Hermes shell hooks send a JSON event on stdin. This gate returns either an
empty JSON object (allow) or a Hermes-compatible block directive.

The gate is intentionally narrower than an OS sandbox. High-authority tools
are denied by default; real host containment must come from Docker/VM/another
isolated Hermes terminal backend.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any

MODULE_ROOT = Path(os.environ.get("AXM_HERMES_ROOT", Path(__file__).resolve().parents[1])).resolve()
POLICY_FILE = Path(os.environ.get("AXM_HERMES_POLICY_FILE", MODULE_ROOT / "runtime" / "policy.json")).resolve()
STATE_DIR = Path(os.environ.get("AXM_HERMES_STATE_DIR", MODULE_ROOT / "runtime" / "state")).resolve()
WORKSPACE = Path(os.environ.get("AXM_HERMES_WORKSPACE", MODULE_ROOT / "runtime" / "workspace")).resolve()

HIGH_AUTHORITY = {
    "terminal": "allow_terminal",
    "terminal_tool": "allow_terminal",
    "execute_code": "allow_execute_code",
    "python": "allow_execute_code",
    "computer_use": "allow_computer_use",
    "delegate_task": "allow_delegation",
    "cron": "allow_scheduling",
    "schedule": "allow_scheduling",
    "send_message": "allow_messaging",
}

READ_HINTS = ("read", "view", "list", "search", "grep", "glob", "find")
WRITE_HINTS = ("write", "edit", "patch", "delete", "remove", "move", "rename", "copy", "mkdir", "save", "download")
PATH_KEYS = {
    "path", "file", "file_path", "filepath", "filename", "target", "target_path",
    "destination", "destination_path", "output", "output_path", "source_path",
    "old_path", "new_path", "directory", "cwd", "workdir", "working_directory",
}


def block(reason: str) -> None:
    print(json.dumps({"action": "block", "message": f"AXM gate: {reason}"}, ensure_ascii=False))
    raise SystemExit(0)


def allow() -> None:
    print("{}")
    raise SystemExit(0)


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        block(f"policy unavailable or invalid ({type(exc).__name__})")
    if not isinstance(value, dict):
        block("policy root is not an object")
    return value


def event_from_stdin() -> dict[str, Any]:
    try:
        raw = sys.stdin.read()
        value = json.loads(raw or "{}")
    except Exception:
        block("invalid hook payload")
    if not isinstance(value, dict):
        block("hook payload is not an object")
    return value


def tool_args(event: dict[str, Any]) -> dict[str, Any]:
    value = event.get("tool_input")
    if not isinstance(value, dict):
        value = event.get("args")
    return value if isinstance(value, dict) else {}


def session_key(event: dict[str, Any]) -> str:
    raw = str(event.get("session_id") or event.get("task_id") or event.get("turn_id") or "unknown")
    return hashlib.sha256(raw.encode("utf-8", "replace")).hexdigest()[:24]


def resolve_root(raw: str) -> Path:
    p = Path(os.path.expandvars(os.path.expanduser(raw)))
    if not p.is_absolute():
        p = MODULE_ROOT / p
    return p.resolve(strict=False)


def roots(policy: dict[str, Any], key: str) -> list[Path]:
    values = policy.get("paths", {}).get(key, [])
    if not isinstance(values, list):
        block(f"policy paths.{key} must be a list")
    return [resolve_root(str(v)) for v in values]


def inside(path: Path, allowed: list[Path]) -> bool:
    for root in allowed:
        try:
            path.relative_to(root)
            return True
        except ValueError:
            pass
    return False


def candidate_paths(value: Any, key: str = "") -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for child_key, child in value.items():
            found.extend(candidate_paths(child, str(child_key).lower()))
    elif isinstance(value, list):
        for child in value:
            found.extend(candidate_paths(child, key))
    elif isinstance(value, str) and key in PATH_KEYS:
        if not re.match(r"^[a-z][a-z0-9+.-]*://", value, flags=re.I):
            found.append(value)
    return found


def resolve_tool_path(raw: str) -> Path:
    p = Path(os.path.expandvars(os.path.expanduser(raw)))
    if not p.is_absolute():
        p = WORKSPACE / p
    return p.resolve(strict=False)


def classify(tool: str) -> str:
    lowered = tool.lower()
    if any(token in lowered for token in WRITE_HINTS):
        return "write"
    if any(token in lowered for token in READ_HINTS):
        return "read"
    return "other"


def state_path(event: dict[str, Any]) -> Path:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    return STATE_DIR / f"{session_key(event)}.json"


def read_state(path: Path) -> dict[str, int]:
    if not path.exists():
        return {"tool_calls": 0, "files_read": 0, "files_written": 0}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return {
            "tool_calls": int(value.get("tool_calls", 0)),
            "files_read": int(value.get("files_read", 0)),
            "files_written": int(value.get("files_written", 0)),
        }
    except Exception:
        block("runtime counter state is invalid")


def write_state(path: Path, state: dict[str, int]) -> None:
    # Atomic replacement avoids half-written counter files. Concurrent hooks may
    # still race; AXM therefore treats these counters as a guardrail, not a
    # resource-accounting security boundary.
    fd, temp_name = tempfile.mkstemp(prefix=".axm-state-", dir=str(path.parent), text=True)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(state, handle, sort_keys=True)
            handle.write("\n")
        os.replace(temp_name, path)
    finally:
        try:
            if os.path.exists(temp_name):
                os.unlink(temp_name)
        except OSError:
            pass


def positive_int(policy: dict[str, Any], name: str, default: int) -> int:
    try:
        value = int(policy.get("limits", {}).get(name, default))
    except Exception:
        block(f"invalid limit {name}")
    if value < 1:
        block(f"limit {name} must be positive")
    return value


def main() -> None:
    event = event_from_stdin()
    policy = load_json(POLICY_FILE)

    if policy.get("schema") != "axm.hermes-policy/v1":
        block("unsupported policy schema")
    if policy.get("consent", {}).get("enabled") is not True:
        block("action consent is OFF")

    tool = str(event.get("tool_name") or event.get("tool") or "").strip()
    if not tool:
        block("tool name missing")
    lowered = tool.lower()

    blocked_tools = {str(x).lower() for x in policy.get("blocked_tools", []) if isinstance(x, str)}
    if lowered in blocked_tools:
        block(f"tool '{tool}' is explicitly blocked")

    capabilities = policy.get("capabilities", {})
    for prefix, capability in HIGH_AUTHORITY.items():
        if lowered == prefix or lowered.startswith(prefix + "_"):
            if capabilities.get(capability) is not True:
                block(f"tool '{tool}' requires explicit {capability}=true")

    kind = classify(lowered)
    paths = [resolve_tool_path(raw) for raw in candidate_paths(tool_args(event))]
    if kind == "read":
        allowed_roots = roots(policy, "read_roots")
        if not allowed_roots:
            block("no read roots configured")
        for candidate in paths:
            if not inside(candidate, allowed_roots):
                block(f"read path is outside configured AXM roots: {candidate}")
    elif kind == "write":
        allowed_roots = roots(policy, "write_roots")
        if not allowed_roots:
            block("no write roots configured")
        for candidate in paths:
            if not inside(candidate, allowed_roots):
                block(f"write path is outside configured AXM roots: {candidate}")

    path = state_path(event)
    state = read_state(path)
    max_tools = positive_int(policy, "max_tool_calls_per_session", 15)
    max_reads = positive_int(policy, "max_files_read_per_session", 20)
    max_writes = positive_int(policy, "max_files_written_per_session", 5)

    if state["tool_calls"] >= max_tools:
        block("tool-call limit reached")
    if kind == "read" and state["files_read"] >= max_reads:
        block("file-read limit reached")
    if kind == "write" and state["files_written"] >= max_writes:
        block("file-write limit reached")

    state["tool_calls"] += 1
    if kind == "read":
        state["files_read"] += 1
    elif kind == "write":
        state["files_written"] += 1
    write_state(path, state)
    allow()


if __name__ == "__main__":
    main()
