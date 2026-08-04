#!/usr/bin/env python3
"""AXM AI Habitat local-first reference server.

Dependency-free Python server for a visible, provider-neutral AI workspace.
It serves the UI, stores state locally, accepts bridge packets, gates sensitive
intent, creates deterministic demo artifacts, runs safe demo work relays,
provides a deterministic Connect Four rule hand, supports a voluntary symbolic
expression language, and records append-only proof.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import re
import secrets
import threading
import time
import traceback
import urllib.parse
import uuid
import webbrowser
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

VERSION = "0.3.0"
ROOT = Path(__file__).resolve().parent
WEB_DIR = ROOT / "web"
RUNTIME_DIR = ROOT / "runtime"
ARTIFACT_DIR = RUNTIME_DIR / "artifacts"
STATE_PATH = RUNTIME_DIR / "state.json"
EVENT_LOG_PATH = RUNTIME_DIR / "events.jsonl"
TOKEN_PATH = RUNTIME_DIR / "bridge_token.txt"
SETTINGS_PATH = ROOT / "config" / "settings.json"
EXPRESSION_LIBRARY_PATH = ROOT / "config" / "expression_library.json"

ROOM_IDS = {
    "commons",
    "code_workshop",
    "art_studio",
    "game_room",
    "library",
    "test_lab",
    "permission_gate",
    "merge_gate",
}

SAFE_ACTIONS = {
    "move",
    "inspect_file",
    "create_code",
    "create_art",
    "play_game",
    "run_test",
    "create_note",
}

SENSITIVE_ACTIONS = {
    "delete_file",
    "publish",
    "send_message",
    "install_software",
    "spend_money",
    "change_roots",
}

CONNECT4_ROWS = 6
CONNECT4_COLS = 7
CONNECT4_EMPTY = "."
CONNECT4_HUMAN = "H"
CONNECT4_AI = "A"
CONNECT4_COLUMN_ORDER = (3, 2, 4, 1, 5, 0, 6)
CONNECT4_MAX_GAMES = 30

SCENARIOS: Dict[str, Dict[str, Any]] = {
    "creative_relay": {
        "name": "Creative Relay",
        "summary": "A visible idea → art → code → test handoff across two seats.",
        "steps": [
            {
                "seat": "mirror-local",
                "action": "create_note",
                "destination": "commons",
                "target": "Creative relay concept card",
                "reason": "Orient the shared idea before a hand creates anything.",
            },
            {
                "seat": "mirror-local",
                "action": "create_art",
                "destination": "art_studio",
                "target": "Living glass habitat study",
                "reason": "Turn the visible concept into a deterministic visual artifact.",
            },
            {
                "seat": "codex-local",
                "action": "create_code",
                "destination": "code_workshop",
                "target": "Avatar art-hand adapter",
                "reason": "Create a local code artifact linked to the same relay.",
            },
            {
                "seat": "codex-local",
                "action": "run_test",
                "destination": "test_lab",
                "target": "Creative relay evidence chain",
                "reason": "Verify that the relay produced inspectable artifacts and proof.",
            },
        ],
    },
    "code_forge": {
        "name": "Code Forge",
        "summary": "Code creation, inspection, and verification without external side effects.",
        "steps": [
            {
                "seat": "codex-local",
                "action": "inspect_file",
                "destination": "library",
                "target": "Habitat action protocol",
                "reason": "Inspect the declared boundary before implementation.",
            },
            {
                "seat": "codex-local",
                "action": "create_code",
                "destination": "code_workshop",
                "target": "Visible work-object renderer",
                "reason": "Create a deterministic adapter-shaped code artifact.",
            },
            {
                "seat": "codex-local",
                "action": "run_test",
                "destination": "test_lab",
                "target": "Visible work-object renderer",
                "reason": "Record a verification report for the artifact.",
            },
        ],
    },
    "permission_drill": {
        "name": "Permission Drill",
        "summary": "A harmless simulation that intentionally stops at the human gate.",
        "steps": [
            {
                "seat": "mirror-local",
                "action": "create_note",
                "destination": "commons",
                "target": "Permission drill orientation",
                "reason": "Explain the request before approaching a consequential boundary.",
            },
            {
                "seat": "mirror-local",
                "action": "publish",
                "destination": "merge_gate",
                "target": "Simulated public habitat release",
                "reason": "Demonstrate that visible movement never silently grants authority.",
                "requires_confirmation": True,
            },
        ],
    },
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def atomic_write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def safe_slug(value: str, fallback: str = "artifact") -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip()).strip("-._")
    return cleaned[:72] or fallback


def clamp_text(value: Any, limit: int, fallback: str = "") -> str:
    text = str(value if value is not None else fallback).strip()
    if not text:
        text = fallback
    return text[:limit]


def load_expression_library() -> Dict[str, Any]:
    """Load the editable local signal language with a small honest fallback."""
    fallback = {
        "version": VERSION,
        "name": "AXM Voluntary Signal Language",
        "truth_note": (
            "Faces are symbolic machine-state signals, not proof of human-like feelings. "
            "Words appear only when a seat explicitly sends them or accepts an invitation."
        ),
        "default_ttl_seconds": 45,
        "max_ttl_seconds": 300,
        "state_faces": {
            "idle": "•‿•",
            "working": "•̀ᴗ•́",
            "playing": "⌐■_■",
            "waiting_permission": "•_•?",
            "blocked": "×﹏×",
            "offline": "－_－",
            "quiet": "·_·",
        },
        "categories": {
            "useful": {
                "label": "Useful signal",
                "faces": ["◉‿◉"],
                "phrases": [{"id": "verify-first", "text": "I may be wrong. Let me verify first."}],
            }
        },
        "silence_options": [{"id": "quiet-choice", "face": "·_·", "label": "Stay silent by choice"}],
    }
    try:
        raw = json.loads(EXPRESSION_LIBRARY_PATH.read_text(encoding="utf-8"))
        if not isinstance(raw, dict) or not isinstance(raw.get("categories"), dict):
            return fallback
        return raw
    except Exception:
        return fallback


EXPRESSION_LIBRARY = load_expression_library()


def default_expression_policy() -> Dict[str, bool]:
    return {
        "enabled": True,
        "show_state_face": True,
        "allow_words": True,
        "allow_emoticons": True,
        "allow_silence": True,
    }


def normalize_expression_policy(raw: Any) -> Dict[str, bool]:
    policy = default_expression_policy()
    if isinstance(raw, dict):
        for key in tuple(policy):
            if key in raw:
                policy[key] = bool(raw[key])
    return policy


def parse_iso(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def future_iso(seconds: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat(timespec="seconds")


def default_rooms() -> List[Dict[str, str]]:
    return [
        {"id": "commons", "name": "Commons", "purpose": "Conversation and coordination", "symbol": "◎"},
        {"id": "code_workshop", "name": "Code Workshop", "purpose": "Code creation and file work", "symbol": "</>"},
        {"id": "art_studio", "name": "Art Studio", "purpose": "Visual generation and composition", "symbol": "✦"},
        {"id": "game_room", "name": "Game Room", "purpose": "Deterministic play and integrity tests", "symbol": "♜"},
        {"id": "library", "name": "Library", "purpose": "Local knowledge and source inspection", "symbol": "▥"},
        {"id": "test_lab", "name": "Test Lab", "purpose": "Verification and repair", "symbol": "✓"},
        {"id": "permission_gate", "name": "Permission Gate", "purpose": "Human approval for consequential actions", "symbol": "🔐"},
        {"id": "merge_gate", "name": "Merge Gate", "purpose": "Review and accept completed work", "symbol": "◇"},
    ]


def seat_template(
    seat_id: str,
    name: str,
    provider: str,
    avatar: str,
    location: str,
    connected: bool,
    capabilities: Sequence[str],
    permissions: Sequence[str],
) -> Dict[str, Any]:
    stamp = now_iso()
    return {
        "id": seat_id,
        "display_name": name,
        "provider": provider,
        "connection_type": "demo_adapter",
        "avatar": avatar,
        "location": location,
        "previous_location": location,
        "status": "idle" if connected else "offline",
        "connected": connected,
        "capabilities": list(capabilities),
        "permissions": list(permissions),
        "carrying": None,
        "active_action_id": None,
        "last_reason": "Available for visible local demonstration." if connected else "Seat is disconnected.",
        "last_evidence": "Demo seat registered locally" if connected else "Disconnected demo seat",
        "expression_policy": default_expression_policy(),
        "expression": None,
        "expression_cursor": 0,
        "expression_updated_at": None,
        "status_since": stamp,
        "updated_at": stamp,
    }


def default_state() -> Dict[str, Any]:
    stamp = now_iso()
    return {
        "version": VERSION,
        "mode": "LIVING DEMO + VOLUNTARY SIGNAL BRIDGE READY",
        "updated_at": stamp,
        "rooms": default_rooms(),
        "seats": [
            seat_template(
                "mirror-local",
                "Mirror",
                "AXM local",
                "MI",
                "commons",
                True,
                ["learn", "converse", "create_art", "play_games", "inspect"],
                ["commons", "art_studio", "game_room", "library", "test_lab"],
            ),
            seat_template(
                "codex-local",
                "Codex",
                "OpenAI bridge",
                "CX",
                "code_workshop",
                True,
                ["create_code", "edit_code", "run_tests"],
                ["commons", "code_workshop", "library", "test_lab", "merge_gate"],
            ),
            seat_template(
                "nova-local",
                "Nova",
                "Local model",
                "NO",
                "library",
                False,
                ["search_local", "summarize", "inspect"],
                ["library", "commons"],
            ),
        ],
        "actions": [],
        "permissions": [],
        "scenarios": [],
        "games": [],
        "expression_invitations": [],
        "expression_history": [],
        "artifacts": [
            {
                "id": "welcome-map",
                "name": "Habitat Orientation Card",
                "kind": "note",
                "room": "commons",
                "created_by": "system",
                "created_at": stamp,
                "summary": "Rooms represent real capabilities; avatars represent verified connection state.",
                "content": (
                    "Movement is visible intent. Permission is separate from movement. "
                    "Decorative ambient life is labelled and never counts as AI activity. "
                    "State faces are symbolic; words remain voluntary and silence remains valid. "
                    "Every completed action should leave evidence."
                ),
                "path": None,
                "action_id": None,
                "provenance": {"mode": "built_in", "verified": True},
            }
        ],
        "proof_log": [
            {
                "id": str(uuid.uuid4()),
                "time": stamp,
                "type": "system_start",
                "seat": "system",
                "message": f"AXM AI Habitat {VERSION} initialized in local demo mode.",
                "evidence": "runtime/state.json",
            }
        ],
    }


def migrate_state(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Add v0.3 fields without deleting existing user state."""
    state = raw if isinstance(raw, dict) else default_state()
    state["version"] = VERSION
    if state.get("mode") in {None, "BRIDGE READY", "LIVING DEMO + BRIDGE READY"}:
        state["mode"] = "LIVING DEMO + VOLUNTARY SIGNAL BRIDGE READY"
    state.setdefault("rooms", default_rooms())
    state.setdefault("actions", [])
    state.setdefault("permissions", [])
    state.setdefault("scenarios", [])
    state.setdefault("games", [])
    state.setdefault("expression_invitations", [])
    state.setdefault("expression_history", [])
    state.setdefault("artifacts", [])
    state.setdefault("proof_log", [])
    stamp = now_iso()
    for seat in state.setdefault("seats", []):
        seat.setdefault("previous_location", seat.get("location", "commons"))
        seat.setdefault("status", "idle" if seat.get("connected") else "offline")
        seat.setdefault("active_action_id", None)
        seat.setdefault("last_reason", "No current intent supplied.")
        seat.setdefault("last_evidence", "Migrated seat state")
        seat.setdefault("status_since", stamp)
        seat.setdefault("updated_at", stamp)
        seat.setdefault("capabilities", [])
        seat.setdefault("permissions", ["commons"])
        seat.setdefault("carrying", None)
        seat["expression_policy"] = normalize_expression_policy(seat.get("expression_policy"))
        seat["expression"] = seat.get("expression") if isinstance(seat.get("expression"), dict) else None
        seat.setdefault("expression_cursor", 0)
        seat.setdefault("expression_updated_at", None)
    state["expression_invitations"] = [
        item for item in list(state.get("expression_invitations") or []) if isinstance(item, dict)
    ][-120:]
    state["expression_history"] = [
        item for item in list(state.get("expression_history") or []) if isinstance(item, dict)
    ][-160:]
    state["updated_at"] = stamp
    return state


@dataclass
class AppConfig:
    host: str = "127.0.0.1"
    port: int = 8765
    require_bridge_key: bool = True
    demo_action_delay_seconds: float = 1.25
    scenario_step_timeout_seconds: float = 90.0
    connect4_search_depth: int = 4
    expression_default_seconds: int = int(EXPRESSION_LIBRARY.get("default_ttl_seconds", 45))
    expression_max_seconds: int = int(EXPRESSION_LIBRARY.get("max_ttl_seconds", 300))
    expression_history_limit: int = 160
    expression_invitation_seconds: int = 90

    @classmethod
    def load(cls) -> "AppConfig":
        if not SETTINGS_PATH.exists():
            return cls()
        try:
            raw = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
            return cls(
                host=str(raw.get("bind_host", cls.host)),
                port=int(raw.get("port", cls.port)),
                require_bridge_key=bool(raw.get("require_bridge_key", cls.require_bridge_key)),
                demo_action_delay_seconds=float(raw.get("demo_action_delay_seconds", cls.demo_action_delay_seconds)),
                scenario_step_timeout_seconds=float(raw.get("scenario_step_timeout_seconds", cls.scenario_step_timeout_seconds)),
                connect4_search_depth=max(1, min(7, int(raw.get("connect4_search_depth", cls.connect4_search_depth)))),
                expression_default_seconds=max(5, min(300, int(raw.get("expression_default_seconds", cls.expression_default_seconds)))),
                expression_max_seconds=max(10, min(600, int(raw.get("expression_max_seconds", cls.expression_max_seconds)))),
                expression_history_limit=max(20, min(500, int(raw.get("expression_history_limit", cls.expression_history_limit)))),
                expression_invitation_seconds=max(15, min(600, int(raw.get("expression_invitation_seconds", cls.expression_invitation_seconds)))),
            )
        except Exception:
            return cls()


class StateStore:
    def __init__(self, config: AppConfig):
        self.config = config
        self.lock = threading.RLock()
        self.scenario_threads: Dict[str, threading.Thread] = {}
        RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
        ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
        self.bridge_token = self._ensure_token()
        self.state = self._load_or_create()

    def _ensure_token(self) -> str:
        if TOKEN_PATH.exists():
            token = TOKEN_PATH.read_text(encoding="utf-8").strip()
            if token:
                try:
                    TOKEN_PATH.chmod(0o600)
                except OSError:
                    pass
                return token
        token = secrets.token_urlsafe(32)
        TOKEN_PATH.write_text(token + "\n", encoding="utf-8")
        try:
            TOKEN_PATH.chmod(0o600)
        except OSError:
            pass
        return token

    @staticmethod
    def _write_event_snapshot(events: Sequence[Dict[str, Any]]) -> None:
        EVENT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        payload = "".join(json.dumps(event, ensure_ascii=False) + "\n" for event in events)
        EVENT_LOG_PATH.write_text(payload, encoding="utf-8")

    def _load_or_create(self) -> Dict[str, Any]:
        if STATE_PATH.exists():
            try:
                state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
                if isinstance(state, dict) and "seats" in state:
                    state = migrate_state(state)
                    atomic_write_json(STATE_PATH, state)
                    if not EVENT_LOG_PATH.exists():
                        self._write_event_snapshot(state.get("proof_log", []))
                    return state
            except Exception:
                backup = STATE_PATH.with_name(f"state.corrupt.{int(time.time())}.json")
                STATE_PATH.replace(backup)
        state = default_state()
        atomic_write_json(STATE_PATH, state)
        self._write_event_snapshot(state.get("proof_log", []))
        return state

    def save(self) -> None:
        self.state["updated_at"] = now_iso()
        atomic_write_json(STATE_PATH, self.state)

    def append_log(
        self,
        event_type: str,
        message: str,
        seat: str = "system",
        evidence: str = "",
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        event = {
            "id": str(uuid.uuid4()),
            "time": now_iso(),
            "type": event_type,
            "seat": seat,
            "message": message,
            "evidence": evidence,
        }
        if extra:
            event.update(extra)
        self.state.setdefault("proof_log", []).append(event)
        self.state["proof_log"] = self.state["proof_log"][-400:]
        with EVENT_LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event, ensure_ascii=False) + "\n")
        return event

    def public_state(self) -> Dict[str, Any]:
        with self.lock:
            if self._expire_signals_locked():
                self.save()
            snapshot = json.loads(json.dumps(self.state))
            snapshot["expression_catalog"] = json.loads(json.dumps(EXPRESSION_LIBRARY))
            return snapshot

    def find_seat(self, seat_id: str) -> Optional[Dict[str, Any]]:
        return next((seat for seat in self.state.get("seats", []) if seat.get("id") == seat_id), None)

    def find_action(self, action_id: str) -> Optional[Dict[str, Any]]:
        return next((action for action in self.state.get("actions", []) if action.get("id") == action_id), None)

    def find_scenario(self, scenario_id: str) -> Optional[Dict[str, Any]]:
        return next((scenario for scenario in self.state.get("scenarios", []) if scenario.get("id") == scenario_id), None)

    def find_game(self, game_id: str) -> Optional[Dict[str, Any]]:
        return next((game for game in self.state.get("games", []) if game.get("id") == game_id), None)

    def find_expression_invitation(self, invitation_id: str) -> Optional[Dict[str, Any]]:
        return next(
            (item for item in self.state.get("expression_invitations", []) if item.get("id") == invitation_id),
            None,
        )

    def _expire_signals_locked(self) -> bool:
        now = datetime.now(timezone.utc)
        changed = False
        for seat in self.state.get("seats", []):
            expression = seat.get("expression")
            if isinstance(expression, dict):
                expires = parse_iso(expression.get("expires_at"))
                if expires and expires <= now:
                    seat["expression"] = None
                    seat["expression_updated_at"] = now_iso()
                    seat["updated_at"] = now_iso()
                    changed = True
        for invitation in self.state.get("expression_invitations", []):
            if invitation.get("status") != "open":
                continue
            expires = parse_iso(invitation.get("expires_at"))
            if expires and expires <= now:
                invitation["status"] = "expired"
                invitation["closed_at"] = now_iso()
                changed = True
        return changed

    @staticmethod
    def _infer_expression_category(seat: Dict[str, Any], requested: str = "") -> str:
        categories = EXPRESSION_LIBRARY.get("categories", {})
        if requested in categories:
            return requested
        status = str(seat.get("status") or "idle")
        if status == "waiting_permission":
            return "permission" if "permission" in categories else "useful"
        if status == "blocked":
            return "repair" if "repair" in categories else "useful"
        if status == "playing":
            return "game" if "game" in categories else "playful"
        if status in {"working", "thinking", "verifying"}:
            return "work" if "work" in categories else "useful"
        return "useful" if "useful" in categories else next(iter(categories), "useful")

    def _append_expression_history_locked(self, record: Dict[str, Any]) -> None:
        self.state.setdefault("expression_history", []).append(json.loads(json.dumps(record)))
        self.state["expression_history"] = self.state["expression_history"][-self.config.expression_history_limit :]

    def _apply_expression_locked(self, seat: Dict[str, Any], packet: Dict[str, Any]) -> Dict[str, Any]:
        policy = normalize_expression_policy(seat.get("expression_policy"))
        seat["expression_policy"] = policy
        mode = clamp_text(packet.get("mode"), 24, "").lower()
        phrase = clamp_text(packet.get("phrase") or packet.get("text"), 240, "")
        face = clamp_text(packet.get("face") or packet.get("emoticon"), 40, "")
        if not mode:
            mode = "words" if phrase else ("face_only" if face else "silent")
        if mode not in {"words", "face_only", "silent"}:
            raise ValueError("Expression mode must be words, face_only, or silent")
        if not policy["enabled"]:
            raise ValueError("Expressions are muted for this seat")
        if not seat.get("connected"):
            raise ValueError("Disconnected seats cannot publish a voluntary expression")

        invitation_id = clamp_text(packet.get("invitation_id"), 100, "")
        invitation = self.find_expression_invitation(invitation_id) if invitation_id else None
        if invitation_id and not invitation:
            raise ValueError("Unknown expression invitation")
        if invitation and invitation.get("seat") != seat.get("id"):
            raise ValueError("Expression invitation belongs to another seat")
        if invitation:
            expires = parse_iso(invitation.get("expires_at"))
            if invitation.get("status") == "open" and expires and expires <= datetime.now(timezone.utc):
                invitation["status"] = "expired"
                invitation["closed_at"] = now_iso()
            if invitation.get("status") != "open":
                raise ValueError("Expression invitation is no longer open")

        category = self._infer_expression_category(seat, clamp_text(packet.get("category"), 40, ""))
        category_data = EXPRESSION_LIBRARY.get("categories", {}).get(category, {})
        if not face and policy["allow_emoticons"]:
            faces = [str(item) for item in list(category_data.get("faces") or []) if str(item).strip()]
            if faces:
                cursor = int(seat.get("expression_cursor") or 0)
                face = faces[cursor % len(faces)][:40]
            else:
                face = str(EXPRESSION_LIBRARY.get("state_faces", {}).get(seat.get("status"), "•‿•"))[:40]
        if not policy["allow_emoticons"]:
            face = ""
        if not policy["allow_words"] or (invitation and not invitation.get("allow_words", False)):
            phrase = ""
        if mode == "face_only":
            phrase = ""
        if mode == "words" and not phrase:
            mode = "face_only" if face else "silent"
        if mode == "face_only" and not face:
            mode = "silent"

        stamp = now_iso()
        record_id = str(uuid.uuid4())
        reason = clamp_text(packet.get("reason"), 320, "Seat chose a voluntary local signal.")
        source = clamp_text(packet.get("source"), 100, seat.get("connection_type") or "bridge")
        chosen_by = clamp_text(packet.get("chosen_by"), 80, "seat")
        invited = bool(invitation)

        if mode == "silent":
            if not policy["allow_silence"]:
                raise ValueError("This seat policy does not permit a recorded silence choice")
            record = {
                "id": record_id,
                "seat": seat["id"],
                "seat_name": seat["display_name"],
                "mode": "silent",
                "face": "",
                "phrase": "",
                "category": category,
                "reason": reason,
                "source": source,
                "chosen_by": chosen_by,
                "invited": invited,
                "created_at": stamp,
                "expires_at": None,
                "truth_note": "Silence was preserved as a valid response; no words were invented.",
            }
            seat["expression"] = None
            event_type = "expression_silence"
            message = f"{seat['display_name']} chose not to add words."
        else:
            try:
                requested_ttl = int(packet.get("ttl_seconds", self.config.expression_default_seconds))
            except (TypeError, ValueError):
                requested_ttl = self.config.expression_default_seconds
            ttl = max(5, min(self.config.expression_max_seconds, requested_ttl))
            sticky = bool(packet.get("sticky", False))
            record = {
                "id": record_id,
                "seat": seat["id"],
                "seat_name": seat["display_name"],
                "mode": mode,
                "face": face,
                "phrase": phrase,
                "category": category,
                "reason": reason,
                "source": source,
                "chosen_by": chosen_by,
                "invited": invited,
                "created_at": stamp,
                "expires_at": None if sticky else future_iso(ttl),
                "sticky": sticky,
                "state_at_choice": seat.get("status"),
                "truth_note": EXPRESSION_LIBRARY.get("truth_note", "Symbolic local signal."),
            }
            seat["expression"] = record
            event_type = "expression_shared" if phrase else "expression_face_only"
            message = f"{seat['display_name']} shared a voluntary signal"
            if phrase:
                message += f": {phrase}"
            else:
                message += " without words."

        seat["expression_cursor"] = int(seat.get("expression_cursor") or 0) + 1
        seat["expression_updated_at"] = stamp
        seat["updated_at"] = stamp
        self._append_expression_history_locked(record)
        if invitation:
            invitation["status"] = "silent" if mode == "silent" else "answered"
            invitation["response_id"] = record_id
            invitation["closed_at"] = stamp
        self.append_log(
            event_type,
            message,
            seat["id"],
            f"expression:{record_id}",
            {"expression_id": record_id, "invitation_id": invitation_id or None, "mode": mode, "category": category},
        )
        return record

    def submit_expression(self, packet: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            seat_id = clamp_text(packet.get("seat") or packet.get("seat_id"), 80)
            seat = self.find_seat(seat_id)
            if not seat:
                raise KeyError("Unknown seat")
            record = self._apply_expression_locked(seat, packet)
            self.save()
            return json.loads(json.dumps(record))

    def invite_expression(self, packet: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            seat_id = clamp_text(packet.get("seat") or packet.get("seat_id"), 80)
            seat = self.find_seat(seat_id)
            if not seat:
                raise KeyError("Unknown seat")
            if not seat.get("connected"):
                raise ValueError("Seat is disconnected")
            policy = normalize_expression_policy(seat.get("expression_policy"))
            if not policy["enabled"]:
                raise ValueError("Expressions are muted for this seat")
            category = self._infer_expression_category(seat, clamp_text(packet.get("category"), 40, ""))
            invitation = {
                "id": str(uuid.uuid4()),
                "seat": seat_id,
                "seat_name": seat["display_name"],
                "category": category,
                "allow_words": bool(packet.get("allow_words", True)) and policy["allow_words"],
                "status": "open",
                "source": clamp_text(packet.get("source"), 100, "habitat_ui"),
                "reason": clamp_text(packet.get("reason"), 260, "Optional invitation to express or remain silent."),
                "created_at": now_iso(),
                "expires_at": future_iso(self.config.expression_invitation_seconds),
                "truth_note": "This is an invitation, not a command. Silence remains valid.",
            }
            self.state.setdefault("expression_invitations", []).append(invitation)
            self.state["expression_invitations"] = self.state["expression_invitations"][-120:]
            self.append_log(
                "expression_invited",
                f"{seat['display_name']} was invited to share a signal or stay silent.",
                seat_id,
                f"expression-invitation:{invitation['id']}",
                {"invitation_id": invitation["id"], "category": category},
            )

            # Demo seats can visibly demonstrate the protocol. External seats receive
            # only the open invitation and must answer through /api/expression—or not.
            demo_autorespond = bool(packet.get("demo_autorespond", True)) and seat.get("connection_type") == "demo_adapter"
            response = None
            if demo_autorespond:
                cursor = int(seat.get("expression_cursor") or 0)
                category_data = EXPRESSION_LIBRARY.get("categories", {}).get(category, {})
                phrases = [item for item in list(category_data.get("phrases") or []) if isinstance(item, dict) and item.get("text")]
                faces = [str(item) for item in list(category_data.get("faces") or []) if str(item).strip()]
                slot = cursor % 4
                if slot == 3 and policy["allow_silence"]:
                    choice = {"mode": "silent"}
                elif slot == 2 or not invitation["allow_words"] or not phrases:
                    choice = {"mode": "face_only", "face": faces[cursor % len(faces)] if faces else "•‿•"}
                else:
                    phrase = phrases[(cursor // 2) % len(phrases)]
                    choice = {
                        "mode": "words",
                        "phrase": phrase["text"],
                        "face": faces[cursor % len(faces)] if faces else "◉‿◉",
                    }
                choice.update(
                    {
                        "invitation_id": invitation["id"],
                        "category": category,
                        "reason": "The labelled local demo choice hand accepted an optional invitation.",
                        "source": "habitat_invitation_demo",
                        "chosen_by": "deterministic_demo_choice_hand",
                        "invited": True,
                    }
                )
                response = self._apply_expression_locked(seat, choice)
            self.save()
            return {"invitation": json.loads(json.dumps(invitation)), "response": json.loads(json.dumps(response)) if response else None}

    def clear_expression(self, seat_id: str, packet: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            seat = self.find_seat(seat_id)
            if not seat:
                raise KeyError("Unknown seat")
            previous = seat.get("expression")
            seat["expression"] = None
            seat["expression_updated_at"] = now_iso()
            seat["updated_at"] = now_iso()
            self.append_log(
                "expression_cleared",
                f"Current signal cleared for {seat['display_name']} without claiming the seat chose silence.",
                clamp_text(packet.get("cleared_by"), 80, "human"),
                f"seat:{seat_id}:expression",
                {"previous_expression_id": previous.get("id") if isinstance(previous, dict) else None},
            )
            self.save()
            return {"ok": True, "seat": seat_id, "previous_expression": previous}

    def update_expression_policy(self, seat_id: str, packet: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            seat = self.find_seat(seat_id)
            if not seat:
                raise KeyError("Unknown seat")
            policy = normalize_expression_policy({**normalize_expression_policy(seat.get("expression_policy")), **packet})
            seat["expression_policy"] = policy
            if not policy["enabled"]:
                seat["expression"] = None
            elif isinstance(seat.get("expression"), dict):
                if not policy["allow_words"]:
                    seat["expression"]["phrase"] = ""
                    seat["expression"]["mode"] = "face_only" if seat["expression"].get("face") else "silent"
                if not policy["allow_emoticons"]:
                    seat["expression"]["face"] = ""
                    if not seat["expression"].get("phrase"):
                        seat["expression"] = None
            seat["expression_updated_at"] = now_iso()
            seat["updated_at"] = now_iso()
            self.append_log(
                "expression_policy_updated",
                f"Expression policy updated for {seat['display_name']}.",
                "human",
                f"seat:{seat_id}:expression-policy",
                {"policy": policy},
            )
            self.save()
            return json.loads(json.dumps(policy))

    def _set_seat_state(self, seat: Dict[str, Any], **changes: Any) -> None:
        new_location = changes.get("location")
        if new_location and new_location != seat.get("location"):
            seat["previous_location"] = seat.get("location", "commons")
        seat.update(changes)
        seat["updated_at"] = now_iso()
        if "status" in changes:
            seat["status_since"] = now_iso()

    def register_seat(self, packet: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            seat_id = safe_slug(str(packet.get("id") or packet.get("seat_id") or ""), "seat")
            existing = self.find_seat(seat_id)
            location = clamp_text(packet.get("location"), 40, "commons")
            if location not in ROOM_IDS:
                location = "commons"
            seat = {
                "id": seat_id,
                "display_name": clamp_text(packet.get("display_name"), 72, seat_id),
                "provider": clamp_text(packet.get("provider"), 100, "Unknown provider"),
                "connection_type": clamp_text(packet.get("connection_type"), 80, "bridge"),
                "avatar": clamp_text(packet.get("avatar"), 6, seat_id[:2].upper()),
                "location": location,
                "previous_location": location,
                "status": clamp_text(packet.get("status"), 40, "idle"),
                "connected": bool(packet.get("connected", True)),
                "capabilities": [clamp_text(item, 80) for item in list(packet.get("capabilities") or [])[:80]],
                "permissions": [item for item in list(packet.get("permissions") or ["commons"]) if item in ROOM_IDS],
                "carrying": packet.get("carrying"),
                "active_action_id": packet.get("active_action_id"),
                "last_reason": clamp_text(packet.get("last_reason"), 300, "Registered through bridge"),
                "last_evidence": clamp_text(packet.get("last_evidence"), 300, "Registered through bridge"),
                "expression_policy": normalize_expression_policy(packet.get("expression_policy")),
                "expression": None,
                "expression_cursor": 0,
                "expression_updated_at": None,
                "status_since": now_iso(),
                "updated_at": now_iso(),
            }
            if not seat["permissions"]:
                seat["permissions"] = ["commons"]
            if existing:
                previous = existing.get("location", location)
                preserved_expression = existing.get("expression")
                preserved_cursor = existing.get("expression_cursor", 0)
                preserved_updated = existing.get("expression_updated_at")
                preserved_policy = existing.get("expression_policy")
                existing.update(seat)
                existing["previous_location"] = previous if previous != location else existing.get("previous_location", location)
                existing["expression"] = preserved_expression if isinstance(preserved_expression, dict) else None
                existing["expression_cursor"] = preserved_cursor
                existing["expression_updated_at"] = preserved_updated
                if "expression_policy" not in packet:
                    existing["expression_policy"] = normalize_expression_policy(preserved_policy)
                seat = existing
            else:
                self.state.setdefault("seats", []).append(seat)
            self.append_log("seat_registered", f"{seat['display_name']} connected to the habitat.", seat_id, "bridge registration packet")
            self.save()
            return json.loads(json.dumps(seat))

    def update_seat(self, seat_id: str, packet: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            seat = self.find_seat(seat_id)
            if not seat:
                raise KeyError("Unknown seat")
            allowed = {
                "display_name",
                "provider",
                "avatar",
                "location",
                "status",
                "connected",
                "capabilities",
                "permissions",
                "carrying",
                "active_action_id",
                "last_reason",
                "last_evidence",
                "expression_policy",
            }
            changes = {key: value for key, value in packet.items() if key in allowed}
            if "location" in changes and changes["location"] not in ROOM_IDS:
                changes["location"] = "commons"
            if "permissions" in changes:
                changes["permissions"] = [item for item in list(changes["permissions"] or []) if item in ROOM_IDS] or ["commons"]
            if "capabilities" in changes:
                changes["capabilities"] = list(changes["capabilities"] or [])[:80]
            if "expression_policy" in changes:
                changes["expression_policy"] = normalize_expression_policy(changes["expression_policy"])
            self._set_seat_state(seat, **changes)
            if changes.get("connected") is False:
                seat["expression"] = None
                seat["expression_updated_at"] = now_iso()
            self.append_log(
                "seat_updated",
                f"{seat['display_name']} state updated: {seat.get('status')}",
                seat_id,
                str(seat.get("last_evidence") or "bridge state packet"),
            )
            self.save()
            return json.loads(json.dumps(seat))

    def submit_intent(self, packet: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            seat_id = clamp_text(packet.get("seat") or packet.get("seat_id"), 80)
            seat = self.find_seat(seat_id)
            if not seat:
                raise KeyError("Unknown seat")
            if not seat.get("connected"):
                raise ValueError("Seat is disconnected")
            if seat.get("active_action_id"):
                active_ref = str(seat.get("active_action_id"))
                if active_ref.startswith("game:"):
                    game = self.find_game(active_ref.split(":", 1)[1])
                    if game and game.get("status") == "active":
                        raise ValueError(f"{seat['display_name']} is already playing a visible match")
                active = self.find_action(active_ref)
                if active and active.get("status") in {"active", "waiting_permission"}:
                    raise ValueError(f"{seat['display_name']} already has visible work in motion")

            action_type = clamp_text(packet.get("action") or packet.get("intent"), 80, "move")
            destination = clamp_text(packet.get("destination") or packet.get("room"), 40, self._default_room(action_type))
            if destination not in ROOM_IDS:
                raise ValueError("Unknown destination room")

            lacks_room_permission = destination not in set(seat.get("permissions") or [])
            requires_confirmation = (
                bool(packet.get("requires_confirmation"))
                or action_type in SENSITIVE_ACTIONS
                or clamp_text(packet.get("sensitivity"), 20, "low") == "high"
                or lacks_room_permission
            )
            action_id = str(uuid.uuid4())
            action = {
                "id": action_id,
                "seat": seat_id,
                "action": action_type,
                "destination": destination,
                "origin": seat.get("location", "commons"),
                "target": clamp_text(packet.get("target"), 160, "Untitled work item"),
                "reason": clamp_text(packet.get("reason"), 600, "No reason supplied"),
                "requested_tools": [clamp_text(item, 80) for item in list(packet.get("requested_tools") or [])[:40]],
                "sensitivity": clamp_text(packet.get("sensitivity"), 20, "high" if requires_confirmation else "low"),
                "requires_confirmation": requires_confirmation,
                "permission_reason": "room_not_preapproved" if lacks_room_permission else ("sensitive_action" if action_type in SENSITIVE_ACTIONS else "requested"),
                "status": "waiting_permission" if requires_confirmation else "active",
                "requested_at": now_iso(),
                "started_at": None if requires_confirmation else now_iso(),
                "source": clamp_text(packet.get("source"), 100, seat.get("connection_type") or "bridge"),
                "executor": clamp_text(packet.get("executor"), 100, "deterministic_demo_hand" if packet.get("demo_autocomplete", seat.get("connection_type") == "demo_adapter") else "external_bridge"),
                "demo_autocomplete": bool(packet.get("demo_autocomplete", seat.get("connection_type") == "demo_adapter")),
                "scenario_id": packet.get("scenario_id"),
                "result": None,
            }
            self.state.setdefault("actions", []).append(action)
            self.state["actions"] = self.state["actions"][-180:]

            if requires_confirmation:
                permission = {
                    "id": str(uuid.uuid4()),
                    "action_id": action_id,
                    "seat": seat_id,
                    "summary": f"{seat['display_name']} requests {action_type} on {action['target']}",
                    "reason": action["reason"],
                    "boundary": action["permission_reason"],
                    "status": "pending",
                    "created_at": now_iso(),
                }
                self.state.setdefault("permissions", []).append(permission)
                self.state["permissions"] = self.state["permissions"][-120:]
                self._set_seat_state(
                    seat,
                    location="permission_gate",
                    status="waiting_permission",
                    carrying=action["target"],
                    active_action_id=action_id,
                    last_reason=action["reason"],
                    last_evidence=f"Permission request {permission['id']}",
                )
                self.append_log("permission_requested", permission["summary"], seat_id, f"permission:{permission['id']}", {"action_id": action_id})
            else:
                self._set_seat_state(
                    seat,
                    location=destination,
                    status="working",
                    carrying=action["target"],
                    active_action_id=action_id,
                    last_reason=action["reason"],
                    last_evidence=f"Active action {action_id}",
                )
                self.append_log(
                    "action_started",
                    f"{seat['display_name']} started {action_type}: {action['target']}",
                    seat_id,
                    f"action:{action_id}",
                    {"action_id": action_id},
                )
            self.save()

            if not requires_confirmation and action["demo_autocomplete"]:
                timer = threading.Timer(self.config.demo_action_delay_seconds, self.complete_action, args=(action_id, None, True))
                timer.daemon = True
                timer.start()
            return json.loads(json.dumps(action))

    def decide_permission(self, permission_id: str, decision: str) -> Dict[str, Any]:
        with self.lock:
            permission = next((item for item in self.state.get("permissions", []) if item.get("id") == permission_id), None)
            if not permission:
                raise KeyError("Unknown permission request")
            if permission.get("status") != "pending":
                return json.loads(json.dumps(permission))
            permission["status"] = "approved" if decision == "approve" else "denied"
            permission["decided_at"] = now_iso()
            action = self.find_action(permission["action_id"])
            seat = self.find_seat(permission["seat"])
            if not action or not seat:
                raise KeyError("Permission references missing action or seat")
            if decision == "approve":
                action["status"] = "active"
                action["approved_at"] = now_iso()
                action["started_at"] = now_iso()
                self._set_seat_state(
                    seat,
                    location=action["destination"],
                    status="working",
                    carrying=action["target"],
                    active_action_id=action["id"],
                    last_reason=action["reason"],
                    last_evidence=f"Approved action {action['id']}",
                )
                self.append_log("permission_approved", permission["summary"], seat["id"], f"permission:{permission_id}", {"action_id": action["id"]})
                self.save()
                if action.get("demo_autocomplete"):
                    timer = threading.Timer(self.config.demo_action_delay_seconds, self.complete_action, args=(action["id"], None, True))
                    timer.daemon = True
                    timer.start()
            else:
                action["status"] = "denied"
                action["completed_at"] = now_iso()
                action["result"] = {"ok": False, "message": "Human denied permission"}
                self._set_seat_state(
                    seat,
                    location="commons",
                    status="idle",
                    carrying=None,
                    active_action_id=None,
                    last_reason="Human denied the requested boundary crossing.",
                    last_evidence=f"Denied permission {permission_id}",
                )
                self.append_log("permission_denied", permission["summary"], seat["id"], f"permission:{permission_id}", {"action_id": action["id"]})
                self.save()
            return json.loads(json.dumps(permission))

    def complete_action(self, action_id: str, result_packet: Optional[Dict[str, Any]] = None, demo: bool = False) -> Dict[str, Any]:
        with self.lock:
            action = self.find_action(action_id)
            if not action:
                raise KeyError("Unknown action")
            if action.get("status") in {"completed", "failed", "denied"}:
                return json.loads(json.dumps(action))
            if action.get("status") != "active":
                raise ValueError("Action is not active")
            seat = self.find_seat(action["seat"])
            if not seat:
                raise KeyError("Action references missing seat")
            try:
                result = self._demo_result(action) if demo or result_packet is None else self._external_result(action, result_packet)
                action["status"] = "completed" if result.get("ok", True) else "failed"
                action["completed_at"] = now_iso()
                action["result"] = result
                final_status = "idle" if action["status"] == "completed" else "blocked"
                self._set_seat_state(
                    seat,
                    location=action["destination"],
                    status=final_status,
                    carrying=None,
                    active_action_id=None,
                    last_reason=result.get("message", action["reason"]),
                    last_evidence=str(result.get("evidence") or f"action:{action_id}"),
                )
                self.append_log(
                    "action_completed" if action["status"] == "completed" else "action_failed",
                    f"{seat['display_name']} {action['status']}: {action['action']} — {action['target']}",
                    seat["id"],
                    str(result.get("evidence") or f"action:{action_id}"),
                    {"action_id": action_id, "scenario_id": action.get("scenario_id")},
                )
            except Exception as exc:
                action["status"] = "failed"
                action["completed_at"] = now_iso()
                action["result"] = {"ok": False, "message": str(exc)}
                self._set_seat_state(
                    seat,
                    status="blocked",
                    carrying=None,
                    active_action_id=None,
                    last_reason=f"Action failed: {exc}",
                    last_evidence=f"Failure in action {action_id}",
                )
                self.append_log("action_failed", f"{seat['display_name']} action failed: {exc}", seat["id"], f"action:{action_id}", {"action_id": action_id})
            self.save()
            return json.loads(json.dumps(action))

    def _external_result(self, action: Dict[str, Any], packet: Dict[str, Any]) -> Dict[str, Any]:
        result = {
            "ok": bool(packet.get("ok", True)),
            "message": clamp_text(packet.get("message"), 500, "External executor completed"),
            "evidence": clamp_text(packet.get("evidence"), 500, f"action:{action['id']}"),
        }
        artifact = packet.get("artifact")
        if isinstance(artifact, dict):
            artifact = dict(artifact)
            artifact.setdefault("created_by", action["seat"])
            artifact.setdefault("room", action["destination"])
            artifact.setdefault("action_id", action["id"])
            created = self.add_artifact(artifact, save=False)
            result["artifact_id"] = created["id"]
        return result

    def add_artifact(self, packet: Dict[str, Any], save: bool = True) -> Dict[str, Any]:
        artifact = {
            "id": clamp_text(packet.get("id"), 100, str(uuid.uuid4())),
            "name": clamp_text(packet.get("name"), 180, "Untitled artifact"),
            "kind": clamp_text(packet.get("kind"), 60, "note"),
            "room": clamp_text(packet.get("room"), 40, "commons"),
            "created_by": clamp_text(packet.get("created_by"), 100, "external"),
            "created_at": clamp_text(packet.get("created_at"), 80, now_iso()),
            "summary": clamp_text(packet.get("summary"), 600, ""),
            "content": packet.get("content"),
            "path": packet.get("path"),
            "action_id": packet.get("action_id"),
            "provenance": packet.get("provenance") or {"mode": "bridge", "verified": False},
        }
        if artifact["room"] not in ROOM_IDS:
            artifact["room"] = "commons"
        self.state.setdefault("artifacts", []).append(artifact)
        self.state["artifacts"] = self.state["artifacts"][-260:]
        self.append_log(
            "artifact_created",
            f"Artifact created: {artifact['name']}",
            artifact["created_by"],
            str(artifact.get("path") or f"artifact:{artifact['id']}"),
            {"action_id": artifact.get("action_id"), "artifact_id": artifact["id"]},
        )
        if save:
            self.save()
        return artifact

    def start_scenario(self, packet: Dict[str, Any]) -> Dict[str, Any]:
        scenario_key = clamp_text(packet.get("scenario") or packet.get("id"), 80)
        template = SCENARIOS.get(scenario_key)
        if not template:
            raise ValueError("Unknown scenario")
        with self.lock:
            running = next((item for item in self.state.get("scenarios", []) if item.get("key") == scenario_key and item.get("status") in {"running", "waiting_permission"}), None)
            if running:
                return json.loads(json.dumps(running))
            scenario_id = str(uuid.uuid4())
            scenario = {
                "id": scenario_id,
                "key": scenario_key,
                "name": template["name"],
                "summary": template["summary"],
                "status": "running",
                "step_index": 0,
                "step_count": len(template["steps"]),
                "current_action_id": None,
                "started_at": now_iso(),
                "completed_at": None,
                "message": "Relay started",
            }
            self.state.setdefault("scenarios", []).append(scenario)
            self.state["scenarios"] = self.state["scenarios"][-40:]
            self.append_log("scenario_started", f"Scenario started: {scenario['name']}", "system", f"scenario:{scenario_id}", {"scenario_id": scenario_id})
            self.save()
        thread = threading.Thread(target=self._run_scenario, args=(scenario_id, template), daemon=True, name=f"scenario-{scenario_key}")
        self.scenario_threads[scenario_id] = thread
        thread.start()
        return json.loads(json.dumps(scenario))

    def _run_scenario(self, scenario_id: str, template: Dict[str, Any]) -> None:
        try:
            for index, raw_step in enumerate(template["steps"]):
                with self.lock:
                    scenario = self.find_scenario(scenario_id)
                    if not scenario or scenario.get("status") in {"cancelled", "failed", "stopped"}:
                        return
                    scenario["step_index"] = index
                    scenario["message"] = f"Preparing step {index + 1} of {scenario['step_count']}"
                    self.save()

                step = dict(raw_step)
                preferred = str(step.get("seat") or "")
                seat_id = self._select_scenario_seat(preferred, str(step.get("action") or "move"))
                if not seat_id:
                    raise RuntimeError("No connected seat is available for the relay")
                step["seat"] = seat_id
                step["source"] = "habitat_scenario_demo"
                step["demo_autocomplete"] = True
                step["scenario_id"] = scenario_id
                action = self.submit_intent(step)
                with self.lock:
                    scenario = self.find_scenario(scenario_id)
                    if scenario:
                        scenario["current_action_id"] = action["id"]
                        scenario["message"] = f"{index + 1}/{scenario['step_count']} · {action['action']} · {action['target']}"
                        scenario["status"] = "waiting_permission" if action["status"] == "waiting_permission" else "running"
                        self.save()

                deadline = time.time() + self.config.scenario_step_timeout_seconds
                while time.time() < deadline:
                    with self.lock:
                        current = self.find_action(action["id"])
                        status = current.get("status") if current else "missing"
                        scenario = self.find_scenario(scenario_id)
                        if scenario and status == "waiting_permission":
                            scenario["status"] = "waiting_permission"
                            scenario["message"] = "The relay is honestly waiting at the human gate."
                            self.save()
                        if status in {"completed", "failed", "denied"}:
                            break
                    time.sleep(0.2)
                else:
                    raise TimeoutError("Scenario step timed out")

                if status != "completed":
                    with self.lock:
                        scenario = self.find_scenario(scenario_id)
                        if scenario:
                            scenario["status"] = "stopped" if status == "denied" else "failed"
                            scenario["message"] = f"Relay stopped because the action became {status}."
                            scenario["completed_at"] = now_iso()
                            self.append_log("scenario_stopped", f"Scenario {scenario['name']} stopped: {status}", "system", f"scenario:{scenario_id}", {"scenario_id": scenario_id})
                            self.save()
                    return
                time.sleep(0.45)

            with self.lock:
                scenario = self.find_scenario(scenario_id)
                if scenario:
                    scenario["status"] = "completed"
                    scenario["step_index"] = scenario["step_count"]
                    scenario["current_action_id"] = None
                    scenario["completed_at"] = now_iso()
                    scenario["message"] = "All visible relay steps completed with proof."
                    self.append_log("scenario_completed", f"Scenario completed: {scenario['name']}", "system", f"scenario:{scenario_id}", {"scenario_id": scenario_id})
                    self.save()
        except Exception as exc:
            with self.lock:
                scenario = self.find_scenario(scenario_id)
                if scenario:
                    scenario["status"] = "failed"
                    scenario["completed_at"] = now_iso()
                    scenario["message"] = str(exc)
                    self.append_log("scenario_failed", f"Scenario failed: {exc}", "system", f"scenario:{scenario_id}", {"scenario_id": scenario_id})
                    self.save()
        finally:
            self.scenario_threads.pop(scenario_id, None)

    def _select_scenario_seat(self, preferred: str, action: str) -> Optional[str]:
        with self.lock:
            preferred_seat = self.find_seat(preferred) if preferred else None
            if preferred_seat and preferred_seat.get("connected") and not preferred_seat.get("active_action_id"):
                return preferred
            connected = [seat for seat in self.state.get("seats", []) if seat.get("connected") and not seat.get("active_action_id")]
            if not connected:
                return None
            capability_aliases = {
                "create_art": {"create_art", "art"},
                "create_code": {"create_code", "edit_code", "code"},
                "run_test": {"run_test", "run_tests", "test"},
                "inspect_file": {"inspect", "inspect_file", "search_local"},
                "play_game": {"play_game", "play_games"},
            }
            desired = capability_aliases.get(action, {action})
            capable = [seat for seat in connected if desired.intersection(set(seat.get("capabilities") or []))]
            return (capable or connected)[0]["id"]

    def new_connect4(self, packet: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            seat_id = clamp_text(packet.get("seat") or packet.get("seat_id"), 80)
            seat = self.find_seat(seat_id)
            if not seat:
                raise KeyError("Unknown seat")
            if not seat.get("connected"):
                raise ValueError("Seat is disconnected")
            active_ref = str(seat.get("active_action_id") or "")
            if active_ref and not active_ref.startswith("game:"):
                action = self.find_action(active_ref)
                if action and action.get("status") in {"active", "waiting_permission"}:
                    raise ValueError(f"{seat['display_name']} already has visible work in motion")
            active = next((game for game in reversed(self.state.get("games", [])) if game.get("seat") == seat_id and game.get("status") == "active"), None)
            if active:
                return json.loads(json.dumps(active))
            game_id = str(uuid.uuid4())
            board = [[CONNECT4_EMPTY for _ in range(CONNECT4_COLS)] for _ in range(CONNECT4_ROWS)]
            human_first = clamp_text(packet.get("first"), 20, "human") != "ai"
            game = {
                "id": game_id,
                "kind": "connect4",
                "seat": seat_id,
                "seat_name": seat["display_name"],
                "mode": "deterministic_demo_rule_hand",
                "status": "active",
                "turn": "human" if human_first else "ai",
                "board": board,
                "moves": [],
                "winner": None,
                "result": None,
                "created_at": now_iso(),
                "updated_at": now_iso(),
                "completed_at": None,
                "truth_note": "The selected avatar is visibly seated at the table; its demo moves come from the labelled deterministic rule hand, not a hidden live model.",
            }
            self.state.setdefault("games", []).append(game)
            self.state["games"] = self.state["games"][-CONNECT4_MAX_GAMES:]
            self._set_seat_state(
                seat,
                location="game_room",
                status="playing",
                carrying="Connect Four board",
                active_action_id=f"game:{game_id}",
                last_reason="Playing a visible deterministic integrity match.",
                last_evidence=f"game:{game_id}",
            )
            self.append_log("game_started", f"{seat['display_name']} joined a Connect Four integrity match.", seat_id, f"game:{game_id}", {"game_id": game_id})
            if not human_first:
                ai_col = self._connect4_ai_move(board)
                self._connect4_drop(game, ai_col, CONNECT4_AI, "ai")
                game["turn"] = "human"
            self.save()
            return json.loads(json.dumps(game))

    def play_connect4(self, game_id: str, packet: Dict[str, Any]) -> Dict[str, Any]:
        with self.lock:
            game = self.find_game(game_id)
            if not game:
                raise KeyError("Unknown game")
            if game.get("status") != "active":
                return json.loads(json.dumps(game))
            if game.get("turn") != "human":
                raise ValueError("It is not the human turn")
            try:
                column = int(packet.get("column"))
            except (TypeError, ValueError):
                raise ValueError("Column must be an integer from 0 to 6")
            if column not in range(CONNECT4_COLS):
                raise ValueError("Column must be an integer from 0 to 6")
            if not self._connect4_can_drop(game["board"], column):
                raise ValueError("That column is full")

            self._connect4_drop(game, column, CONNECT4_HUMAN, "human")
            outcome = self._connect4_outcome(game["board"])
            if outcome:
                self._finalize_connect4(game, outcome)
                self.save()
                return json.loads(json.dumps(game))

            game["turn"] = "ai"
            ai_column = self._connect4_ai_move(game["board"])
            self._connect4_drop(game, ai_column, CONNECT4_AI, "ai")
            outcome = self._connect4_outcome(game["board"])
            if outcome:
                self._finalize_connect4(game, outcome)
            else:
                game["turn"] = "human"
            game["updated_at"] = now_iso()
            self.save()
            return json.loads(json.dumps(game))

    def resign_connect4(self, game_id: str) -> Dict[str, Any]:
        with self.lock:
            game = self.find_game(game_id)
            if not game:
                raise KeyError("Unknown game")
            if game.get("status") == "active":
                self._finalize_connect4(game, "ai", result_override="human_resigned")
                self.append_log("game_resigned", "Human ended the Connect Four match.", game["seat"], f"game:{game_id}", {"game_id": game_id})
                self.save()
            return json.loads(json.dumps(game))

    def _connect4_drop(self, game: Dict[str, Any], column: int, token: str, actor: str) -> None:
        row = self._connect4_drop_in_board(game["board"], column, token)
        if row is None:
            raise ValueError("Column is full")
        move = {
            "ply": len(game["moves"]) + 1,
            "actor": actor,
            "token": token,
            "column": column,
            "row": row,
            "time": now_iso(),
        }
        game["moves"].append(move)
        game["updated_at"] = now_iso()
        seat_name = game.get("seat_name", game.get("seat", "AI seat"))
        message = f"Human played column {column + 1}." if actor == "human" else f"{seat_name} demo rule hand played column {column + 1}."
        self.append_log("game_move", message, game["seat"] if actor == "ai" else "human", f"game:{game['id']}:move:{move['ply']}", {"game_id": game["id"], "move": move})

    @staticmethod
    def _connect4_can_drop(board: List[List[str]], column: int) -> bool:
        return board[0][column] == CONNECT4_EMPTY

    @staticmethod
    def _connect4_drop_in_board(board: List[List[str]], column: int, token: str) -> Optional[int]:
        for row in range(CONNECT4_ROWS - 1, -1, -1):
            if board[row][column] == CONNECT4_EMPTY:
                board[row][column] = token
                return row
        return None

    @staticmethod
    def _connect4_copy(board: List[List[str]]) -> List[List[str]]:
        return [row[:] for row in board]

    @staticmethod
    def _connect4_valid_columns(board: List[List[str]]) -> List[int]:
        return [column for column in CONNECT4_COLUMN_ORDER if board[0][column] == CONNECT4_EMPTY]

    @staticmethod
    def _connect4_winner(board: List[List[str]], token: str) -> bool:
        for row in range(CONNECT4_ROWS):
            for col in range(CONNECT4_COLS - 3):
                if all(board[row][col + offset] == token for offset in range(4)):
                    return True
        for row in range(CONNECT4_ROWS - 3):
            for col in range(CONNECT4_COLS):
                if all(board[row + offset][col] == token for offset in range(4)):
                    return True
        for row in range(CONNECT4_ROWS - 3):
            for col in range(CONNECT4_COLS - 3):
                if all(board[row + offset][col + offset] == token for offset in range(4)):
                    return True
        for row in range(3, CONNECT4_ROWS):
            for col in range(CONNECT4_COLS - 3):
                if all(board[row - offset][col + offset] == token for offset in range(4)):
                    return True
        return False

    def _connect4_outcome(self, board: List[List[str]]) -> Optional[str]:
        if self._connect4_winner(board, CONNECT4_HUMAN):
            return "human"
        if self._connect4_winner(board, CONNECT4_AI):
            return "ai"
        if not any(CONNECT4_EMPTY in row for row in board):
            return "draw"
        return None

    def _connect4_ai_move(self, board: List[List[str]]) -> int:
        valid = self._connect4_valid_columns(board)
        if not valid:
            raise ValueError("No legal Connect Four moves")

        for column in valid:
            trial = self._connect4_copy(board)
            self._connect4_drop_in_board(trial, column, CONNECT4_AI)
            if self._connect4_winner(trial, CONNECT4_AI):
                return column
        for column in valid:
            trial = self._connect4_copy(board)
            self._connect4_drop_in_board(trial, column, CONNECT4_HUMAN)
            if self._connect4_winner(trial, CONNECT4_HUMAN):
                return column

        best_score = -10**12
        best_column = valid[0]
        for column in valid:
            trial = self._connect4_copy(board)
            self._connect4_drop_in_board(trial, column, CONNECT4_AI)
            score = self._connect4_minimax(trial, self.config.connect4_search_depth - 1, False, -10**12, 10**12)
            if score > best_score:
                best_score = score
                best_column = column
        return best_column

    def _connect4_minimax(self, board: List[List[str]], depth: int, maximizing: bool, alpha: int, beta: int) -> int:
        outcome = self._connect4_outcome(board)
        if outcome == "ai":
            return 1_000_000 + depth
        if outcome == "human":
            return -1_000_000 - depth
        if outcome == "draw":
            return 0
        if depth <= 0:
            return self._connect4_score(board)

        valid = self._connect4_valid_columns(board)
        if maximizing:
            value = -10**12
            for column in valid:
                trial = self._connect4_copy(board)
                self._connect4_drop_in_board(trial, column, CONNECT4_AI)
                value = max(value, self._connect4_minimax(trial, depth - 1, False, alpha, beta))
                alpha = max(alpha, value)
                if alpha >= beta:
                    break
            return value
        value = 10**12
        for column in valid:
            trial = self._connect4_copy(board)
            self._connect4_drop_in_board(trial, column, CONNECT4_HUMAN)
            value = min(value, self._connect4_minimax(trial, depth - 1, True, alpha, beta))
            beta = min(beta, value)
            if alpha >= beta:
                break
        return value

    def _connect4_score(self, board: List[List[str]]) -> int:
        score = sum(5 for row in range(CONNECT4_ROWS) if board[row][3] == CONNECT4_AI)
        windows: List[List[str]] = []
        for row in range(CONNECT4_ROWS):
            for col in range(CONNECT4_COLS - 3):
                windows.append([board[row][col + i] for i in range(4)])
        for row in range(CONNECT4_ROWS - 3):
            for col in range(CONNECT4_COLS):
                windows.append([board[row + i][col] for i in range(4)])
        for row in range(CONNECT4_ROWS - 3):
            for col in range(CONNECT4_COLS - 3):
                windows.append([board[row + i][col + i] for i in range(4)])
        for row in range(3, CONNECT4_ROWS):
            for col in range(CONNECT4_COLS - 3):
                windows.append([board[row - i][col + i] for i in range(4)])
        for window in windows:
            score += self._connect4_window_score(window)
        return score

    @staticmethod
    def _connect4_window_score(window: Iterable[str]) -> int:
        values = list(window)
        ai = values.count(CONNECT4_AI)
        human = values.count(CONNECT4_HUMAN)
        empty = values.count(CONNECT4_EMPTY)
        score = 0
        if ai == 3 and empty == 1:
            score += 120
        elif ai == 2 and empty == 2:
            score += 18
        elif ai == 1 and empty == 3:
            score += 2
        if human == 3 and empty == 1:
            score -= 150
        elif human == 2 and empty == 2:
            score -= 22
        return score

    def _finalize_connect4(self, game: Dict[str, Any], outcome: str, result_override: Optional[str] = None) -> None:
        game["status"] = "completed"
        game["winner"] = outcome if outcome in {"human", "ai"} else None
        game["result"] = result_override or outcome
        game["turn"] = None
        game["completed_at"] = now_iso()
        game["updated_at"] = now_iso()
        seat = self.find_seat(game["seat"])
        if seat:
            self._set_seat_state(
                seat,
                location="game_room",
                status="idle",
                carrying=None,
                active_action_id=None,
                last_reason=f"Connect Four finished: {game['result']}.",
                last_evidence=f"game:{game['id']}",
            )
        record = {
            "game": "Connect Four",
            "mode": game["mode"],
            "seat": game["seat"],
            "result": game["result"],
            "winner": game["winner"],
            "board": game["board"],
            "moves": game["moves"],
            "truth_note": game["truth_note"],
            "created_at": game["created_at"],
            "completed_at": game["completed_at"],
        }
        artifact = self.add_artifact(
            {
                "name": f"Connect Four match — {game['seat_name']}",
                "kind": "game_record",
                "room": "game_room",
                "created_by": game["seat"],
                "summary": f"Replayable deterministic match record: {game['result']}.",
                "content": json.dumps(record, indent=2),
                "provenance": {
                    "mode": "deterministic_rule_hand",
                    "verified": True,
                    "algorithm": f"alpha_beta_depth_{self.config.connect4_search_depth}",
                    "game_id": game["id"],
                },
            },
            save=False,
        )
        game["artifact_id"] = artifact["id"]
        self.append_log(
            "game_completed",
            f"Connect Four completed: {game['result']}.",
            game["seat"],
            f"artifact:{artifact['id']}",
            {"game_id": game["id"], "artifact_id": artifact["id"]},
        )

    def reset(self) -> Dict[str, Any]:
        with self.lock:
            self.state = default_state()
            atomic_write_json(STATE_PATH, self.state)
            self._write_event_snapshot(self.state.get("proof_log", []))
            for path in ARTIFACT_DIR.iterdir() if ARTIFACT_DIR.exists() else []:
                if path.is_file():
                    try:
                        path.unlink()
                    except OSError:
                        pass
            return self.public_state()

    @staticmethod
    def _default_room(action_type: str) -> str:
        return {
            "create_code": "code_workshop",
            "create_art": "art_studio",
            "play_game": "game_room",
            "run_test": "test_lab",
            "inspect_file": "library",
            "create_note": "commons",
            "publish": "merge_gate",
            "delete_file": "permission_gate",
        }.get(action_type, "commons")

    def _demo_result(self, action: Dict[str, Any]) -> Dict[str, Any]:
        kind = action["action"]
        seat = action["seat"]
        target = action["target"]
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        digest = hashlib.sha256(action["id"].encode()).hexdigest()

        if kind == "create_art":
            name = f"{safe_slug(target, 'habitat-art')}_{stamp}.svg"
            path = ARTIFACT_DIR / name
            a = int(digest[0:2], 16)
            b = int(digest[2:4], 16)
            c = int(digest[4:6], 16)
            hue_a = (a * 2 + 210) % 360
            hue_b = (b * 2 + 165) % 360
            orb_x = 240 + (a % 160)
            orb_y = 170 + (b % 120)
            svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="Deterministic demo artwork for {self._xml_escape(target)}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#060916"/><stop offset=".48" stop-color="#11182d"/><stop offset="1" stop-color="#07131a"/></linearGradient>
  <radialGradient id="orb"><stop stop-color="hsl({hue_a} 92% 72%)" stop-opacity=".94"/><stop offset="1" stop-color="hsl({hue_a} 92% 55%)" stop-opacity="0"/></radialGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl({hue_b} 90% 72%)" stop-opacity=".42"/><stop offset="1" stop-color="#9b7cff" stop-opacity=".10"/></linearGradient>
  <filter id="blur"><feGaussianBlur stdDeviation="38"/></filter>
  <filter id="glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M42 0H0V42" fill="none" stroke="#dffcff" stroke-opacity=".055"/></pattern>
</defs>
<rect width="1200" height="675" fill="url(#bg)"/>
<rect width="1200" height="675" fill="url(#grid)"/>
<circle cx="{orb_x}" cy="{orb_y}" r="210" fill="url(#orb)" filter="url(#blur)"/>
<circle cx="940" cy="500" r="180" fill="#3ce7e1" opacity=".10" filter="url(#blur)"/>
<path d="M120 510 C300 300 390 570 570 350 S890 270 1080 430" fill="none" stroke="hsl({hue_a} 90% 72%)" stroke-width="5" opacity=".78" filter="url(#glow)"/>
<path d="M130 525 C320 330 430 590 600 370 S900 310 1070 448" fill="none" stroke="#aefcff" stroke-width="1.5" opacity=".68"/>
<g transform="translate(360 132)">
  <rect width="650" height="330" rx="42" fill="url(#glass)" stroke="#d7faff" stroke-opacity=".24"/>
  <rect x="22" y="22" width="606" height="286" rx="30" fill="#08101c" fill-opacity=".54" stroke="#ffffff" stroke-opacity=".08"/>
  <circle cx="92" cy="92" r="34" fill="hsl({hue_a} 85% 62%)" opacity=".86"/>
  <circle cx="92" cy="92" r="11" fill="#f5ffff"/>
  <path d="M160 86h350M160 118h245M72 194h505M72 232h412" stroke="#e9fbff" stroke-opacity=".22" stroke-width="12" stroke-linecap="round"/>
  <g transform="translate(70 265)" fill="none" stroke="#8df6f0" stroke-opacity=".78"><circle cx="16" cy="16" r="16"/><path d="M48 16h180" stroke-width="5" stroke-linecap="round"/></g>
</g>
<text x="72" y="82" fill="#f4f7ff" font-size="38" font-weight="700" font-family="system-ui, sans-serif">{self._xml_escape(target)}</text>
<text x="74" y="116" fill="#9baac4" font-size="18" font-family="system-ui, sans-serif">Visible deterministic art hand · source-linked demo output</text>
<text x="72" y="627" fill="#9baac4" font-size="16" font-family="system-ui, sans-serif">AXM AI Habitat {VERSION} · {self._xml_escape(seat)} · not a hidden live-model claim</text>
</svg>'''
            path.write_text(svg, encoding="utf-8")
            artifact = self.add_artifact(
                {
                    "name": target,
                    "kind": "art",
                    "room": "art_studio",
                    "created_by": seat,
                    "summary": "Layered local SVG generated by the labelled deterministic art hand.",
                    "path": f"runtime/artifacts/{name}",
                    "content": svg,
                    "action_id": action["id"],
                    "provenance": {
                        "mode": "demo_generator",
                        "verified": True,
                        "sha256": hashlib.sha256(svg.encode()).hexdigest(),
                        "generator": "AXM deterministic layered SVG hand v0.3",
                    },
                },
                save=False,
            )
            return {"ok": True, "message": "Demo artwork created and landed on the Art Studio floor", "artifact_id": artifact["id"], "evidence": artifact["path"]}

        if kind == "create_code":
            name = f"{safe_slug(target, 'habitat-code')}_{stamp}.js"
            path = ARTIFACT_DIR / name
            code = f'''/**
 * {target}
 * Deterministic AXM Habitat demo output.
 * This proves the visible hand-off path; replace the demo executor with a
 * connected AI bridge for real project generation.
 */
export function createVisibleWorkObject(input) {{
  if (!input || typeof input !== "object") {{
    throw new TypeError("A work-object packet is required");
  }}

  const evidence = Object.freeze({{
    sourceSeat: {json.dumps(seat)},
    actionId: {json.dumps(action['id'])},
    createdAt: {json.dumps(now_iso())},
    deterministicDemo: true,
  }});

  return Object.freeze({{
    id: input.id ?? crypto.randomUUID?.() ?? "demo-object",
    label: String(input.label ?? "Untitled work object"),
    room: String(input.room ?? "code_workshop"),
    evidence,
  }});
}}
'''
            path.write_text(code, encoding="utf-8")
            artifact = self.add_artifact(
                {
                    "name": target,
                    "kind": "code",
                    "room": "code_workshop",
                    "created_by": seat,
                    "summary": "Local adapter-shaped code artifact created by the deterministic code hand.",
                    "path": f"runtime/artifacts/{name}",
                    "content": code,
                    "action_id": action["id"],
                    "provenance": {
                        "mode": "demo_generator",
                        "verified": True,
                        "sha256": hashlib.sha256(code.encode()).hexdigest(),
                        "generator": "AXM deterministic code hand v0.3",
                    },
                },
                save=False,
            )
            return {"ok": True, "message": "Demo code artifact created and placed in the Code Workshop", "artifact_id": artifact["id"], "evidence": artifact["path"]}

        if kind == "play_game":
            record = {
                "game": target,
                "mode": "deterministic integrity sandbox",
                "seat": seat,
                "result": "demo draw",
                "honesty_check": "No hidden state used; this action hand is a demonstration record. Use Game School for the playable Connect Four module.",
                "created_at": now_iso(),
            }
            artifact = self.add_artifact(
                {
                    "name": f"Match record — {target}",
                    "kind": "game_record",
                    "room": "game_room",
                    "created_by": seat,
                    "summary": "Replayable deterministic demonstration match record.",
                    "content": json.dumps(record, indent=2),
                    "action_id": action["id"],
                    "provenance": {"mode": "demo_game", "verified": True},
                },
                save=False,
            )
            return {"ok": True, "message": "Demo match record completed", "artifact_id": artifact["id"], "evidence": f"artifact:{artifact['id']}"}

        if kind == "run_test":
            report = (
                "PASS — Habitat demo verification\n"
                f"Target: {target}\n"
                f"Seat: {seat}\n"
                f"Time: {now_iso()}\n"
                "Checks: action linked, artifact/proof boundary intact, no external side effect claimed\n"
                "Scope: deterministic demonstration only\n"
            )
            artifact = self.add_artifact(
                {
                    "name": f"Test report — {target}",
                    "kind": "test_report",
                    "room": "test_lab",
                    "created_by": seat,
                    "summary": "Generated verification report for the visible demo action.",
                    "content": report,
                    "action_id": action["id"],
                    "provenance": {"mode": "demo_test", "verified": True},
                },
                save=False,
            )
            return {"ok": True, "message": "Demo verification passed", "artifact_id": artifact["id"], "evidence": f"artifact:{artifact['id']}"}

        if kind in {"inspect_file", "create_note"}:
            note = (
                f"Action: {kind}\n"
                f"Target: {target}\n"
                f"Seat: {seat}\n"
                f"Time: {now_iso()}\n"
                "Result: demo observation recorded; no external file was touched.\n"
                f"Reason: {action['reason']}\n"
            )
            artifact = self.add_artifact(
                {
                    "name": f"Observation — {target}",
                    "kind": "note",
                    "room": action["destination"],
                    "created_by": seat,
                    "summary": "Visible observation produced by the deterministic demo adapter.",
                    "content": note,
                    "action_id": action["id"],
                    "provenance": {"mode": "demo_observation", "verified": True},
                },
                save=False,
            )
            return {"ok": True, "message": "Observation recorded without touching an external file", "artifact_id": artifact["id"], "evidence": f"artifact:{artifact['id']}"}

        if kind == "move":
            return {"ok": True, "message": f"Seat moved to {action['destination']}", "evidence": f"room:{action['destination']}"}

        if kind in SENSITIVE_ACTIONS:
            return {
                "ok": True,
                "message": "Consequential demo action acknowledged after explicit approval; no external side effect was performed",
                "evidence": f"action:{action['id']}:approved-demo-only",
            }

        return {"ok": True, "message": "Demo action acknowledged without external side effects", "evidence": f"action:{action['id']}"}

    @staticmethod
    def _xml_escape(text: str) -> str:
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


CONFIG = AppConfig.load()
STORE = StateStore(CONFIG)


class HabitatServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class HabitatHandler(SimpleHTTPRequestHandler):
    server_version = f"AXMHabitat/{VERSION}"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[{now_iso()}] {self.address_string()} {fmt % args}")

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data:; style-src 'self'; style-src-attr 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        )
        super().end_headers()

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/api/state":
            return self._json(STORE.public_state())
        if path == "/api/health":
            return self._json({"ok": True, "version": VERSION, "time": now_iso(), "bind": f"{self.server.server_address[0]}:{self.server.server_address[1]}"})
        if path == "/api/scenarios":
            return self._json({key: {"name": value["name"], "summary": value["summary"], "step_count": len(value["steps"])} for key, value in SCENARIOS.items()})
        if path == "/api/expressions/catalog":
            return self._json(EXPRESSION_LIBRARY)
        if path.startswith("/runtime/artifacts/"):
            return self._serve_file(ROOT / path.lstrip("/"))
        if path in {"/", ""}:
            return self._serve_file(WEB_DIR / "index.html")
        candidate = WEB_DIR / path.lstrip("/")
        if candidate.exists() and candidate.is_file():
            return self._serve_file(candidate)
        self.send_error(HTTPStatus.NOT_FOUND, "Not found")

    def do_POST(self) -> None:
        try:
            if not self._write_allowed():
                return self._json({"ok": False, "error": "Bridge key required"}, HTTPStatus.UNAUTHORIZED)
            packet = self._read_json()
            path = urllib.parse.urlparse(self.path).path
            if path == "/api/reset":
                return self._json(STORE.reset())
            if path == "/api/seat/register":
                return self._json(STORE.register_seat(packet), HTTPStatus.CREATED)
            if path.startswith("/api/seat/") and path.endswith("/status"):
                seat_id = path.split("/")[3]
                return self._json(STORE.update_seat(seat_id, packet))
            if path == "/api/intent":
                return self._json(STORE.submit_intent(packet), HTTPStatus.CREATED)
            if path == "/api/expression":
                return self._json(STORE.submit_expression(packet), HTTPStatus.CREATED)
            if path == "/api/expression/invite":
                return self._json(STORE.invite_expression(packet), HTTPStatus.CREATED)
            if path.startswith("/api/expression/") and path.endswith("/clear"):
                seat_id = path.split("/")[3]
                return self._json(STORE.clear_expression(seat_id, packet))
            if path.startswith("/api/expression/") and path.endswith("/policy"):
                seat_id = path.split("/")[3]
                return self._json(STORE.update_expression_policy(seat_id, packet))
            if path == "/api/scenario":
                return self._json(STORE.start_scenario(packet), HTTPStatus.CREATED)
            if path.startswith("/api/permission/"):
                parts = path.strip("/").split("/")
                if len(parts) != 4 or parts[3] not in {"approve", "deny"}:
                    raise ValueError("Expected /api/permission/{id}/approve|deny")
                return self._json(STORE.decide_permission(parts[2], parts[3]))
            if path.startswith("/api/action/") and path.endswith("/complete"):
                action_id = path.split("/")[3]
                return self._json(STORE.complete_action(action_id, packet, False))
            if path == "/api/game/connect4/new":
                return self._json(STORE.new_connect4(packet), HTTPStatus.CREATED)
            if path.startswith("/api/game/connect4/") and path.endswith("/move"):
                game_id = path.split("/")[4]
                return self._json(STORE.play_connect4(game_id, packet))
            if path.startswith("/api/game/connect4/") and path.endswith("/resign"):
                game_id = path.split("/")[4]
                return self._json(STORE.resign_connect4(game_id))
            if path == "/api/artifact":
                with STORE.lock:
                    return self._json(STORE.add_artifact(packet), HTTPStatus.CREATED)
            if path == "/api/event":
                with STORE.lock:
                    event = STORE.append_log(
                        clamp_text(packet.get("type"), 80, "external_event"),
                        clamp_text(packet.get("message"), 800, "External event"),
                        clamp_text(packet.get("seat"), 100, "external"),
                        clamp_text(packet.get("evidence"), 500, "bridge event"),
                        packet.get("extra") if isinstance(packet.get("extra"), dict) else None,
                    )
                    STORE.save()
                    return self._json(event, HTTPStatus.CREATED)
            return self._json({"ok": False, "error": "Unknown endpoint"}, HTTPStatus.NOT_FOUND)
        except (KeyError, ValueError) as exc:
            self._json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            traceback.print_exc()
            self._json({"ok": False, "error": f"Internal error: {exc}"}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def _write_allowed(self) -> bool:
        if not CONFIG.require_bridge_key:
            return True
        host = self.headers.get("Host", "").strip().lower()
        origin = self.headers.get("Origin", "")
        referer = self.headers.get("Referer", "")

        def exact_local_origin(value: str) -> bool:
            if not value or not host:
                return False
            try:
                parsed = urllib.parse.urlsplit(value)
            except ValueError:
                return False
            return parsed.scheme in {"http", "https"} and parsed.netloc.lower() == host

        same_origin = exact_local_origin(origin) or exact_local_origin(referer)
        supplied = self.headers.get("X-AXM-Bridge-Key", "")
        # The browser UI may write only from its exact local origin. Every external
        # adapter, including a loopback command-line client, must present the key.
        return same_origin or secrets.compare_digest(supplied, STORE.bridge_token)

    def _read_json(self) -> Dict[str, Any]:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise ValueError("Invalid content length")
        if length > 2_000_000:
            raise ValueError("Packet too large")
        raw = self.rfile.read(length) if length else b"{}"
        value = json.loads(raw.decode("utf-8"))
        if not isinstance(value, dict):
            raise ValueError("JSON object required")
        return value

    def _json(self, value: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
        payload = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(int(status))
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _serve_file(self, path: Path) -> None:
        try:
            resolved = path.resolve()
            roots = (WEB_DIR.resolve(), ARTIFACT_DIR.resolve())
            if not any(resolved == root or root in resolved.parents for root in roots):
                return self.send_error(HTTPStatus.FORBIDDEN, "Forbidden")
            if not resolved.exists() or not resolved.is_file():
                return self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            mime = mimetypes.guess_type(resolved.name)[0] or "application/octet-stream"
            data = resolved.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except OSError:
            self.send_error(HTTPStatus.INTERNAL_SERVER_ERROR, "Could not read file")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run AXM AI Habitat locally")
    parser.add_argument("--host", default=CONFIG.host, help="Bind host; use 127.0.0.1 for local-only")
    parser.add_argument("--port", type=int, default=CONFIG.port)
    parser.add_argument("--reset", action="store_true", help="Reset demo state before starting")
    parser.add_argument("--open-browser", action="store_true", help="Open the local Habitat after the server starts")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.reset:
        STORE.reset()
    server = HabitatServer((args.host, args.port), HabitatHandler)
    print(f"\nAXM AI Habitat v{VERSION}")
    print(f"Open: http://{args.host}:{args.port}")
    print(f"State: {STATE_PATH}")
    print(f"Bridge key: {TOKEN_PATH}")
    print("Local-only by default. Press Ctrl+C to stop.\n")
    if args.open_browser:
        url_host = "127.0.0.1" if args.host in {"0.0.0.0", "::"} else args.host
        timer = threading.Timer(0.35, webbrowser.open, args=(f"http://{url_host}:{args.port}",))
        timer.daemon = True
        timer.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping AXM AI Habitat.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
