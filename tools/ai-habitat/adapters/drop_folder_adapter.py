#!/usr/bin/env python3
"""Simple no-dependency drop-folder adapter.

An existing platform bridge can write JSON packets to runtime/bridge_inbox.
This process forwards each packet to the matching Habitat endpoint, then moves
it to bridge_processed or bridge_failed. It never invents completion evidence.
"""
from __future__ import annotations

import json
import shutil
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "runtime"
INBOX = RUNTIME / "bridge_inbox"
PROCESSED = RUNTIME / "bridge_processed"
FAILED = RUNTIME / "bridge_failed"
TOKEN_PATH = RUNTIME / "bridge_token.txt"
BASE_URL = "http://127.0.0.1:8765"

ROUTES = {
    "register_seat": "/api/seat/register",
    "intent": "/api/intent",
    "artifact": "/api/artifact",
    "event": "/api/event",
    "scenario": "/api/scenario",
    "game_new": "/api/game/connect4/new",
    "expression": "/api/expression",
    "expression_invite": "/api/expression/invite",
}


def post(path: str, packet: dict, token: str) -> dict:
    req = urllib.request.Request(
        BASE_URL + path,
        data=json.dumps(packet).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "X-AXM-Bridge-Key": token},
    )
    with urllib.request.urlopen(req, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> None:
    for folder in (INBOX, PROCESSED, FAILED):
        folder.mkdir(parents=True, exist_ok=True)
    token = TOKEN_PATH.read_text(encoding="utf-8").strip()
    print(f"Watching {INBOX}")
    print("Packet shape: {\"type\": \"intent\", \"packet\": {...}}")
    while True:
        for path in sorted(INBOX.glob("*.json")):
            try:
                envelope = json.loads(path.read_text(encoding="utf-8"))
                packet_type = str(envelope.get("type") or "")
                packet = envelope.get("packet")
                if packet_type == "seat_status":
                    seat_id = str(envelope.get("seat_id") or "")
                    route = f"/api/seat/{seat_id}/status"
                elif packet_type == "action_complete":
                    action_id = str(envelope.get("action_id") or "")
                    route = f"/api/action/{action_id}/complete"
                elif packet_type == "game_move":
                    game_id = str(envelope.get("game_id") or "")
                    route = f"/api/game/connect4/{game_id}/move"
                elif packet_type == "game_resign":
                    game_id = str(envelope.get("game_id") or "")
                    route = f"/api/game/connect4/{game_id}/resign"
                elif packet_type == "expression_clear":
                    seat_id = str(envelope.get("seat_id") or "")
                    route = f"/api/expression/{seat_id}/clear"
                elif packet_type == "expression_policy":
                    seat_id = str(envelope.get("seat_id") or "")
                    route = f"/api/expression/{seat_id}/policy"
                else:
                    route = ROUTES.get(packet_type, "")
                if not route or not isinstance(packet, dict):
                    raise ValueError("Unknown packet type or missing packet object")
                result = post(route, packet, token)
                receipt = path.with_suffix(".receipt.json")
                receipt.write_text(json.dumps(result, indent=2), encoding="utf-8")
                shutil.move(str(path), PROCESSED / path.name)
                shutil.move(str(receipt), PROCESSED / receipt.name)
                print("Processed", path.name)
            except Exception as exc:
                error_path = FAILED / f"{path.stem}.error.txt"
                error_path.write_text(str(exc), encoding="utf-8")
                shutil.move(str(path), FAILED / path.name)
                print("Failed", path.name, exc)
        time.sleep(0.75)


if __name__ == "__main__":
    main()
