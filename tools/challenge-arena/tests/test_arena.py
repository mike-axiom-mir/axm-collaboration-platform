from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from axm_challenge_arena import ChallengeArena
from axm_challenge_arena.demo import run_demo
from axm_challenge_arena.errors import ValidationError
from axm_challenge_arena.presets import generic_packet


def _submission_manifest(
    arena: ChallengeArena,
    challenge_id: str,
    participant_id: str,
    *,
    path: str = "result.txt",
    deliverable_id: str = "primary",
    media_type: str = "text/plain",
) -> dict:
    state = arena.get(challenge_id)
    return {
        "challenge_id": challenge_id,
        "packet_hash": state["packet_hash"],
        "rubric_hash": state["rubric_hash"],
        "participant_id": participant_id,
        "artifacts": [{
            "path": path,
            "deliverable_id": deliverable_id,
            "role": "primary",
            "media_type": media_type,
            "provenance": {"origin": "test", "rights": "CC0"},
        }],
    }


class ChallengeArenaTests(unittest.TestCase):
    def test_complete_demo_and_integrity(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            state = run_demo(temp)
            self.assertEqual(state["state"], "SYNTHESIZED")
            self.assertTrue(state["result"]["provisional_winner"])
            self.assertEqual(
                state["review_assignment_report"]["schema_version"],
                "axm.challenge-review-assignment/0.3",
            )
            self.assertTrue(state["review_assignment_report"]["assignment_hash"])
            self.assertEqual(
                {review["schema_version"] for review in state["reviews"].values()},
                {"axm.challenge-review/0.4"},
            )
            self.assertTrue(state["review_content_safety"]["non_punitive"])
            arena = ChallengeArena(temp)
            report = arena.verify_integrity("arena-demo-001")
            self.assertTrue(report["valid"], report)
            self.assertGreaterEqual(report["event_chain"]["event_count"], 16)

    def test_self_vote_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("self-vote-test", "Self vote test", "Prove that self-voting is blocked.")
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("self-vote-test", participant)
            arena.lock_challenge("self-vote-test")
            for participant in ("one", "two"):
                source = Path(temp) / participant
                source.mkdir()
                (source / "result.txt").write_text(participant, encoding="utf-8")
                arena.submit(
                    "self-vote-test",
                    participant,
                    source,
                    _submission_manifest(arena, "self-vote-test", participant),
                )
            arena.close_submissions("self-vote-test")
            arena.run_deterministic_checks("self-vote-test")
            arena.open_review("self-vote-test")
            packet_for_one = arena.review_packet("self-vote-test", "one")
            own_label = packet_for_one["own_blind_label"]
            other_label = packet_for_one["candidate_labels"][0]
            scores = {criterion["id"]: 50 for criterion in packet_for_one["peer_criteria"]}
            bad_review = {
                "rubric_hash": packet_for_one["rubric_hash"],
                "evaluations": {
                    own_label: {"scores": scores},
                    other_label: {"scores": scores},
                },
                "ranking": [own_label, other_label],
            }
            with self.assertRaises(ValidationError):
                arena.submit_review("self-vote-test", "one", bad_review)

    def test_submission_revision_is_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("revision-test", "Revision test", "Preserve old submissions.")
            arena.create_challenge(packet)
            arena.register_participant("revision-test", "one")
            arena.register_participant("revision-test", "two")
            arena.lock_challenge("revision-test")
            source = Path(temp) / "source"
            source.mkdir()
            (source / "result.txt").write_text("first", encoding="utf-8")
            manifest = _submission_manifest(arena, "revision-test", "one")
            first = arena.submit("revision-test", "one", source, manifest)
            (source / "result.txt").write_text("second", encoding="utf-8")
            second = arena.submit(
                "revision-test", "one", source, manifest, replace=True,
                expected_previous_submission_id=first["submission_id"],
            )
            state = arena.get("revision-test")
            self.assertEqual(state["submissions"][first["submission_id"]]["status"], "SUPERSEDED")
            self.assertEqual(state["submissions"][first["submission_id"]]["superseded_by"], second["submission_id"])
            self.assertTrue((arena.store.challenge_dir("revision-test") / state["submissions"][first["submission_id"]]["relative_directory"]).is_dir())

    def test_artifact_tamper_is_detected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            run_demo(temp)
            arena = ChallengeArena(temp)
            state = arena.get("arena-demo-001")
            active = next(item for item in state["submissions"].values() if item["status"] == "ACTIVE")
            manifest_path = arena.store.challenge_dir("arena-demo-001") / active["relative_directory"] / "submission.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            artifact = arena.store.challenge_dir("arena-demo-001") / active["relative_directory"] / "artifacts" / manifest["artifacts"][0]["path"]
            artifact.write_text("tampered", encoding="utf-8")
            report = arena.verify_integrity("arena-demo-001")
            self.assertFalse(report["valid"])
            self.assertTrue(any("artifact hash mismatch" in error for error in report["errors"]))

    def test_public_view_does_not_leak_live_ballots_or_author_map(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("blind-view-test", "Blind view test", "Keep live authorship sealed.")
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("blind-view-test", participant)
            arena.lock_challenge("blind-view-test")
            for participant in ("one", "two"):
                source = Path(temp) / f"source-{participant}"
                source.mkdir()
                (source / "result.txt").write_text(participant, encoding="utf-8")
                arena.submit(
                    "blind-view-test", participant, source,
                    _submission_manifest(arena, "blind-view-test", participant),
                )
            arena.close_submissions("blind-view-test")
            arena.run_deterministic_checks("blind-view-test")
            arena.open_review("blind-view-test")
            packet_one = arena.review_packet("blind-view-test", "one")
            label = packet_one["candidate_labels"][0]
            scores = {criterion["id"]: 50 for criterion in packet_one["peer_criteria"]}
            arena.submit_review(
                "blind-view-test", "one",
                {
                    "schema_version": "axm.challenge-review/0.4",
                    "rubric_hash": packet_one["rubric_hash"],
                    "assignment_hash": packet_one["assignment_hash"],
                    "review_packet_hash": packet_one["review_packet_hash"],
                    "evaluations": {
                        label: {
                            "scores": scores,
                            "evidence_refs": {
                                criterion_id: [{
                                    "kind": "artifact",
                                    "path": "result.txt",
                                    "note": "reviewed declared artifact",
                                }]
                                for criterion_id in scores
                            },
                        }
                    },
                    "ranking_tiers": [[label]],
                    "ranking": [label],
                    "overall_reason": "sealed",
                },
            )
            public = arena.public_view("blind-view-test")
            self.assertTrue(all(value is None for value in public["blind_map"].values()))
            self.assertNotIn("participant_id", next(iter(public["submissions"].values())))
            review = next(iter(public["reviews"].values()))
            self.assertNotIn("reviewer_id", review)
            self.assertNotIn("evaluations", review)



if __name__ == "__main__":
    unittest.main()
