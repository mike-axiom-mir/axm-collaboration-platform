"""Minimal direct Python connection example for an AXM module."""

import json
from pathlib import Path

from axm_challenge_arena import ChallengeArena
from axm_challenge_arena.integrations import packet_from_module_job
from axm_challenge_arena.utils import read_json

ROOT = Path(__file__).resolve().parents[1]
job = read_json(ROOT / "examples" / "module_job_asset_factory.json", max_bytes=1024 * 1024)
packet = packet_from_module_job(job)

arena = ChallengeArena(ROOT / "workspace")
if not arena.store.exists(packet["challenge_id"]):
    arena.create_challenge(packet, actor="asset_factory")

print(
    json.dumps(
        {
            "challenge_id": packet["challenge_id"],
            "state": arena.get(packet["challenge_id"])["state"],
            "next": "register participants, review the draft, then lock",
        },
        indent=2,
    )
)
