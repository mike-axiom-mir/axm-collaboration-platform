from __future__ import annotations

import json
import tempfile
import unittest
import threading
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

from axm_challenge_arena import ChallengeArena, verify_evidence_bundle
from axm_challenge_arena.demo import run_demo
from axm_challenge_arena.presets import generic_packet
from axm_challenge_arena.server import build_server


def _repack_reversed(source: Path, destination: Path) -> None:
    with zipfile.ZipFile(source, "r") as src, zipfile.ZipFile(
        destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
    ) as dst:
        for info in reversed(src.infolist()):
            payload = src.read(info)
            copied = zipfile.ZipInfo(info.filename, info.date_time)
            copied.compress_type = info.compress_type
            copied.comment = info.comment
            copied.extra = info.extra
            copied.internal_attr = info.internal_attr
            copied.external_attr = info.external_attr
            copied.create_system = info.create_system
            copied.flag_bits = info.flag_bits & ~0x1
            dst.writestr(copied, payload)


def _manifest_for(arena: ChallengeArena, challenge_id: str, participant_id: str) -> dict:
    state = arena.get(challenge_id)
    return {
        "challenge_id": challenge_id,
        "packet_hash": state["packet_hash"],
        "rubric_hash": state["rubric_hash"],
        "participant_id": participant_id,
        "summary": f"candidate from {participant_id}",
        "artifacts": [
            {
                "path": "result.txt",
                "deliverable_id": "primary",
                "role": "primary",
                "media_type": "text/plain",
                "provenance": {"origin": "test", "rights": "CC0"},
            }
        ],
    }


def _http_json(server, path: str) -> dict:
    host, port = server.server_address
    with urllib.request.urlopen(f"http://{host}:{port}{path}", timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


class V06PortabilityTests(unittest.TestCase):
    def test_standalone_bundle_verifier_ignores_zip_member_order(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "workspace"
            run_demo(root)
            arena = ChallengeArena(root)
            baseline = Path(temp) / "baseline.zip"
            reordered = Path(temp) / "reordered.zip"
            arena.export_evidence_bundle("arena-demo-001", baseline)
            _repack_reversed(baseline, reordered)
            report = verify_evidence_bundle(reordered)
            assert report["valid"], report
            assert report["event_count"] > 1

    def test_public_progress_and_observer_progress_hide_seat_identity(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "workspace"
            arena = ChallengeArena(root)
            packet = generic_packet("observer-progress", "Observer progress", "Identity-safe progress")
            arena.create_challenge(packet)
            arena.register_participant("observer-progress", "alpha-seat")
            arena.register_participant("observer-progress", "beta-seat")
            arena.lock_challenge("observer-progress")
            source = Path(temp) / "candidate"
            source.mkdir()
            (source / "result.txt").write_text("alpha", encoding="utf-8")
            arena.submit(
                "observer-progress",
                "alpha-seat",
                source,
                _manifest_for(arena, "observer-progress", "alpha-seat"),
            )
            raw = arena.progress("observer-progress")
            assert raw["submitters"]["completed"] == ["alpha-seat"]
            public = arena.public_progress("observer-progress")
            encoded = json.dumps(public, sort_keys=True)
            assert "alpha-seat" not in encoded
            assert "beta-seat" not in encoded
            assert public["submitters"]["completed_count"] == 1
            assert public["submitters"]["missing_count"] == 1

            server = build_server(root, host="127.0.0.1", port=0)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                payload = _http_json(server, "/api/progress/observer-progress")
                encoded = json.dumps(payload, sort_keys=True)
                assert "alpha-seat" not in encoded
                assert "beta-seat" not in encoded
                assert payload["details_hidden"] is True
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)

    def test_public_integrity_hides_forensic_identity_even_when_invalid(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "workspace"
            arena = ChallengeArena(root)
            packet = generic_packet("observer-integrity", "Observer integrity", "Safe integrity")
            arena.create_challenge(packet)
            arena.register_participant("observer-integrity", "alpha-seat")
            arena.register_participant("observer-integrity", "beta-seat")
            arena.lock_challenge("observer-integrity")

            state_path = root / "challenges" / "observer-integrity" / "state.json"
            state = json.loads(state_path.read_text(encoding="utf-8"))
            state["seat_tasks"]["build-alpha-seat"]["status"] = "BROKEN_STATUS"
            state_path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", encoding="utf-8")

            raw = arena.verify_integrity("observer-integrity")
            assert not raw["valid"]
            assert "alpha-seat" in json.dumps(raw)
            public = arena.public_integrity_view("observer-integrity")
            encoded = json.dumps(public, sort_keys=True)
            assert "alpha-seat" not in encoded
            assert "beta-seat" not in encoded
            assert public["valid"] is False
            assert public["error_count"] > 0
            assert public["details_hidden"] is True

    def test_public_lineage_hides_copied_participant_ids_and_selected_labels(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "workspace"
            run_demo(root)
            arena = ChallengeArena(root)
            parent = arena.get("arena-demo-001")
            winner = parent["result"]["provisional_winner"]
            arena.spawn_followup(
                "arena-demo-001",
                "observer-followup",
                mode="BEAT_WINNER",
                selected_blind_labels=[winner],
                copy_participants=True,
            )
            raw = arena.lineage_view("arena-demo-001")
            assert raw["recorded_followups"][0]["copied_participants"]
            public = arena.public_lineage_view("arena-demo-001")
            encoded = json.dumps(public, sort_keys=True)
            for participant_id in parent["participants"]:
                assert participant_id not in encoded
            assert winner not in encoded
            assert public["recorded_followups"][0]["copied_participant_count"] == len(
                parent["participants"]
            )
            assert public["recorded_followups"][0]["selected_candidate_count"] == 1


class V06ObserverErrorTests(unittest.TestCase):
    def test_observer_error_response_hides_forensic_exception_text(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "workspace"
            server = build_server(root, host="127.0.0.1", port=0)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                host, port = server.server_address
                try:
                    urllib.request.urlopen(
                        f"http://{host}:{port}/api/progress/secret-seat-name", timeout=5
                    )
                    raise AssertionError("expected HTTP 400")
                except urllib.error.HTTPError as exc:
                    payload = json.loads(exc.read().decode("utf-8"))
                    assert payload["details_hidden"] is True
                    assert payload["message"].startswith("Observer request failed")
                    assert "secret-seat-name" not in payload["message"]
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)
