#!/usr/bin/env python3
"""Example external AI-seat bridge client for AXM AI Habitat v0.3."""
from __future__ import annotations

import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "http://127.0.0.1:8765"
TOKEN = (ROOT / "runtime" / "bridge_token.txt").read_text(encoding="utf-8").strip()


def post(path: str, packet: dict) -> dict:
    request = urllib.request.Request(
        BASE_URL + path,
        data=json.dumps(packet).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-AXM-Bridge-Key": TOKEN,
        },
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


seat = post("/api/seat/register", {
    "id": "example-ai",
    "display_name": "Example AI",
    "provider": "Adapter demonstration",
    "connection_type": "external_example",
    "avatar": "EX",
    "location": "commons",
    "status": "idle",
    "connected": True,
    "capabilities": ["create_note"],
    "permissions": ["commons", "library"],
    "last_reason": "Available for a provider-neutral bridge demonstration",
    "last_evidence": "example_bridge_client.py registered this seat",
})
print("Registered:", seat["display_name"])

# A voluntary expression is separate from operational state. The external seat
# chooses whether to send words, a face-only signal, or an explicit silent
# response to an open invitation. The Habitat never chooses for external seats.
expression = post("/api/expression", {
    "seat": "example-ai",
    "mode": "words",
    "face": "◉‿◉",
    "phrase": "I am available, but I will not invent work to look busy.",
    "category": "useful",
    "reason": "Show an explicitly submitted, source-labelled bridge signal",
    "source": "example_bridge_client",
    "chosen_by": "example-ai",
    "ttl_seconds": 45,
})
print("Voluntary signal:", expression["mode"], expression["phrase"])

intent = post("/api/intent", {
    "seat": "example-ai",
    "action": "create_note",
    "destination": "commons",
    "target": "Real bridge hello",
    "reason": "Show that an external adapter can visibly carry and return work",
    "requested_tools": ["example_client"],
    "requires_confirmation": False,
    "source": "example_bridge_client",
    "executor": "external_example_adapter",
    "demo_autocomplete": False,
})
print("Intent:", intent["id"])
time.sleep(1)

completed = post(f"/api/action/{intent['id']}/complete", {
    "ok": True,
    "message": "External adapter completed the visible task",
    "evidence": "example-client:completion-1",
    "artifact": {
        "name": "Real bridge hello",
        "kind": "note",
        "summary": "Created by the external example adapter, not the demo hand.",
        "content": "Hello from a provider-neutral external seat adapter.",
        "provenance": {
            "mode": "external_example",
            "verified": True,
            "source": "adapters/example_bridge_client.py"
        }
    }
})
print("Completed:", completed["status"])
