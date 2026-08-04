from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from adapters.workshop_presence import (
    habitat_room,
    habitat_status,
    normalize_local_base,
    seat_packet,
)


class WorkshopPresenceMappingTests(unittest.TestCase):
    def test_loopback_boundary(self) -> None:
        self.assertEqual(normalize_local_base("http://127.0.0.1:8788/path"), "http://127.0.0.1:8788")
        self.assertEqual(normalize_local_base("http://localhost:8765"), "http://localhost:8765")
        self.assertEqual(normalize_local_base("http://[::1]:8765"), "http://[::1]:8765")
        for value in ("https://127.0.0.1:8788", "http://example.com:8788", "http://127.0.0.1"):
            with self.assertRaises(ValueError):
                normalize_local_base(value)

    def test_status_mapping(self) -> None:
        self.assertEqual(habitat_status("thinking"), "working")
        self.assertEqual(habitat_status("paused"), "idle")
        self.assertEqual(habitat_status("tripped"), "blocked")
        self.assertEqual(habitat_status("active", connected=False), "offline")

    def test_room_mapping(self) -> None:
        self.assertEqual(habitat_room("/tools/verification-proof-lab"), "test_lab")
        self.assertEqual(habitat_room("/tools/game-hub"), "game_room")
        self.assertEqual(habitat_room("/tools/ui-ux-builder"), "code_workshop")
        self.assertEqual(habitat_room("/hub/index.html"), "commons")

    def test_seat_packet_is_observational(self) -> None:
        packet = seat_packet({
            "id": "codex",
            "name": "Codex",
            "kind": "ai",
            "state": "acting",
            "location": "/tools/project-room/index.html",
            "lastSeen": "2026-07-28T19:00:00Z",
        })
        self.assertEqual(packet["id"], "workshop-codex")
        self.assertEqual(packet["status"], "working")
        self.assertEqual(packet["location"], "code_workshop")
        self.assertEqual(packet["permissions"], ["commons"])
        self.assertNotIn("create_code", packet["capabilities"])


if __name__ == "__main__":
    unittest.main()
