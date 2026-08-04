#!/usr/bin/env python3
"""Loopback-only presence bridge between AXM Workshop and AI Habitat.

This bridge mirrors declared AXM AI/machine heartbeats into Habitat seats and
announces the Habitat back to the Workshop. It does not call a model, execute
actions, grant permissions, or contact a non-loopback address.
"""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Iterable


LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}
DEFAULT_WORKSHOP_PORTS = tuple(range(8788, 8809))
ROOMS = {
    "commons",
    "code_workshop",
    "art_studio",
    "game_room",
    "library",
    "test_lab",
    "permission_gate",
    "merge_gate",
}


def normalize_local_base(value: str) -> str:
    """Return a normalized HTTP loopback origin or refuse it."""
    parsed = urllib.parse.urlsplit(str(value or "").strip())
    if parsed.scheme != "http" or parsed.hostname not in LOCAL_HOSTS or not parsed.port:
        raise ValueError("Only an explicit HTTP loopback host and port are allowed")
    host = f"[{parsed.hostname}]" if ":" in parsed.hostname else parsed.hostname
    return f"http://{host}:{parsed.port}"


def safe_id(value: Any) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", str(value or "").strip()).strip("-._")
    return cleaned[:52] or "machine"


def initials(name: Any) -> str:
    parts = re.findall(r"[A-Za-z0-9]+", str(name or ""))
    return "".join(part[0] for part in parts[:3]).upper()[:6] or "AXM"


def habitat_status(state: Any, connected: bool = True) -> str:
    if not connected:
        return "offline"
    return {
        "active": "working",
        "acting": "working",
        "thinking": "working",
        "idle": "idle",
        "paused": "idle",
        "ready": "idle",
        "offline": "offline",
        "tripped": "blocked",
    }.get(str(state or "").lower(), "idle")


def habitat_room(location: Any) -> str:
    text = str(location or "").lower()
    rules = (
        (("permission", "approval", "authority"), "permission_gate"),
        (("merge", "publish", "release"), "merge_gate"),
        (("test", "verify", "audit", "proof", "diagnostic"), "test_lab"),
        (("game", "play", "world"), "game_room"),
        (("art", "image", "visual", "design", "film", "audio"), "art_studio"),
        (("doc", "research", "knowledge", "library"), "library"),
        (("code", "build", "project", "tool", "studio"), "code_workshop"),
    )
    for words, room in rules:
        if any(word in text for word in words):
            return room
    return "commons"


def seat_packet(member: dict[str, Any], connected: bool = True) -> dict[str, Any]:
    member_id = safe_id(member.get("id"))
    state = str(member.get("state") or "idle").lower()
    location = str(member.get("location") or "AXM Workshop")[:100]
    name = str(member.get("name") or member_id)[:72]
    kind = str(member.get("kind") or "machine")[:24]
    room = habitat_room(location)
    reason = f"AXM Workshop presence: {state} at {location}" if connected else "AXM Workshop heartbeat expired"
    return {
        "id": f"workshop-{member_id}",
        "display_name": name,
        "provider": f"AXM Workshop {kind} presence",
        "connection_type": "workshop-presence-loopback",
        "avatar": initials(name),
        "location": room,
        "status": habitat_status(state, connected),
        "connected": connected,
        "capabilities": ["workshop.presence.observe", "habitat.signal.receive"],
        "permissions": ["commons"],
        "last_reason": reason[:300],
        "last_evidence": f"{member.get('lastSeen') or 'live'} via /api/presence"[:300],
    }


class WorkshopPresenceBridge:
    def __init__(
        self,
        habitat_base: str,
        habitat_token: str,
        workshop_candidates: Iterable[str] | None = None,
        poll_seconds: float = 5.0,
    ) -> None:
        self.habitat_base = normalize_local_base(habitat_base)
        self.habitat_token = str(habitat_token or "").strip()
        if len(self.habitat_token) < 32:
            raise ValueError("A valid Habitat bridge token is required")
        candidates = workshop_candidates or (f"http://127.0.0.1:{port}" for port in DEFAULT_WORKSHOP_PORTS)
        self.workshop_candidates = tuple(normalize_local_base(item) for item in candidates)
        self.poll_seconds = max(1.0, float(poll_seconds))
        self.workshop_base: str | None = None
        self.last_packets: dict[str, dict[str, Any]] = {}
        self.failures = 0
        self._opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def request_json(
        self,
        url: str,
        method: str = "GET",
        payload: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        timeout: float = 2.5,
    ) -> dict[str, Any]:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != "http" or parsed.hostname not in LOCAL_HOSTS:
            raise ValueError("Presence bridge refused a non-loopback request")
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        request_headers = {"Accept": "application/json", **(headers or {})}
        if body is not None:
            request_headers["Content-Type"] = "application/json"
        request = urllib.request.Request(url, data=body, method=method, headers=request_headers)
        with self._opener.open(request, timeout=timeout) as response:
            value = json.loads(response.read().decode("utf-8"))
        if not isinstance(value, dict):
            raise ValueError("Expected a JSON object")
        return value

    def discover_workshop(self) -> str:
        for base in self.workshop_candidates:
            try:
                payload = self.request_json(base + "/api/presence", timeout=0.8)
                if payload.get("ok") is True and isinstance(payload.get("members"), list):
                    self.workshop_base = base
                    print(f"AXM Workshop presence connected at {base}")
                    return base
            except (OSError, ValueError, urllib.error.URLError, json.JSONDecodeError):
                continue
        raise ConnectionError("AXM Workshop presence API is not currently available")

    def habitat_register(self, packet: dict[str, Any]) -> None:
        self.request_json(
            self.habitat_base + "/api/seat/register",
            method="POST",
            payload=packet,
            headers={"X-AXM-Bridge-Key": self.habitat_token},
        )

    def workshop_heartbeat(self, base: str) -> None:
        self.request_json(
            base + "/api/presence/heartbeat",
            method="POST",
            payload={
                "id": "ai-habitat",
                "name": "AXM AI Habitat",
                "kind": "machine",
                "state": "active",
                "location": "/tools/ai-habitat/workshop.html",
                "ttlMs": 20000,
            },
        )

    @staticmethod
    def eligible(member: dict[str, Any]) -> bool:
        return (
            isinstance(member, dict)
            and member.get("id")
            and member.get("id") != "ai-habitat"
            and member.get("kind") != "human"
        )

    def sync_once(self) -> int:
        base = self.workshop_base or self.discover_workshop()
        self.workshop_heartbeat(base)
        payload = self.request_json(base + "/api/presence")
        members = [member for member in payload.get("members", []) if self.eligible(member)]
        current: dict[str, dict[str, Any]] = {}

        for member in members:
            packet = seat_packet(member)
            current[packet["id"]] = packet
            if self.last_packets.get(packet["id"]) != packet:
                self.habitat_register(packet)

        for seat_id, previous in self.last_packets.items():
            if seat_id in current or previous.get("connected") is False:
                continue
            offline = dict(previous)
            offline.update({
                "connected": False,
                "status": "offline",
                "last_reason": "AXM Workshop heartbeat expired",
            })
            self.habitat_register(offline)
            current[seat_id] = offline

        self.last_packets = current
        self.failures = 0
        return len(members)

    def mark_disconnected(self) -> None:
        updated: dict[str, dict[str, Any]] = {}
        for seat_id, previous in self.last_packets.items():
            if previous.get("connected") is False:
                updated[seat_id] = previous
                continue
            offline = dict(previous)
            offline.update({
                "connected": False,
                "status": "offline",
                "last_reason": "AXM Workshop presence API disconnected",
            })
            try:
                self.habitat_register(offline)
            except Exception:
                pass
            updated[seat_id] = offline
        self.last_packets = updated

    def run_forever(self) -> None:
        announced_failure = False
        while True:
            try:
                count = self.sync_once()
                if announced_failure:
                    print(f"AXM Workshop presence restored; {count} AI/machine seats visible")
                announced_failure = False
            except Exception as exc:
                self.failures += 1
                self.workshop_base = None
                if not announced_failure:
                    print(f"AXM Workshop presence waiting: {exc}")
                    announced_failure = True
                if self.failures == 3:
                    self.mark_disconnected()
            time.sleep(self.poll_seconds)
