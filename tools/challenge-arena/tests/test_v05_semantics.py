from __future__ import annotations

import copy
import json
import re
import tempfile
import unittest
from pathlib import Path

from axm_challenge_arena import ChallengeArena
from axm_challenge_arena.bridge import FileBridge
from axm_challenge_arena.errors import ValidationError
from axm_challenge_arena.orchestration import verify_orchestration_state
from axm_challenge_arena.presets import generic_packet


def manifest(arena: ChallengeArena, cid: str, participant: str) -> dict:
    contract = arena.submission_contract(cid, participant)
    return {
        "schema_version": "axm.challenge-submission/0.2",
        "challenge_id": cid,
        "packet_hash": contract["packet_hash"],
        "rubric_hash": contract["rubric_hash"],
        "participant_roster_hash": contract["participant_roster_hash"],
        "participant_id": participant,
        "artifacts": [
            {
                "path": "result.txt",
                "deliverable_id": "primary",
                "role": "primary",
                "media_type": "text/plain",
                "provenance": {"origin": "v0.5 semantic test", "rights": "CC0"},
            }
        ],
    }


def submit_candidate(arena: ChallengeArena, root: str | Path, cid: str, participant: str, text: str | None = None) -> dict:
    source = Path(root) / f"source-{cid}-{participant}"
    source.mkdir(parents=True, exist_ok=True)
    (source / "result.txt").write_text(text or f"candidate {participant}", encoding="utf-8")
    return arena.submit(cid, participant, source, manifest(arena, cid, participant))


def review_payload(packet: dict, score: float = 70.0) -> dict:
    criteria = [criterion["id"] for criterion in packet["peer_criteria"]]
    return {
        "schema_version": "axm.challenge-review/0.4",
        "rubric_hash": packet["rubric_hash"],
        "assignment_hash": packet["assignment_hash"],
        "review_packet_hash": packet["review_packet_hash"],
        "evaluations": {
            label: {
                "scores": {criterion: score for criterion in criteria},
                "abstentions": {},
                "evidence_refs": {
                    criterion: [
                        {
                            "kind": "artifact",
                            "path": "result.txt",
                            "note": "Inspected the candidate artifact.",
                        }
                    ]
                    for criterion in criteria
                },
                "strengths": ["grounded"],
                "weaknesses": [],
                "risks": [],
                "merge_worthy": [],
            }
            for label in packet["candidate_labels"]
        },
        "ranking_tiers": [[label] for label in packet["candidate_labels"]],
        "ranking": list(packet["candidate_labels"]),
        "overall_reason": "Grounded v0.5 fixture review.",
    }


def to_review(root: str | Path, cid: str, participants: tuple[str, ...], *, groups: dict[str, str] | None = None, packet_mutator=None) -> ChallengeArena:
    arena = ChallengeArena(root)
    packet = generic_packet(cid, "v0.5 semantics", "Exercise v0.5 fairness and integrity semantics.")
    if packet_mutator:
        packet_mutator(packet)
    arena.create_challenge(packet)
    for participant in participants:
        arena.register_participant(
            cid,
            participant,
            independence_group=(groups or {}).get(participant),
        )
    arena.lock_challenge(cid)
    for participant in participants:
        submit_candidate(arena, root, cid, participant)
    arena.close_submissions(cid)
    arena.run_deterministic_checks(cid)
    arena.open_review(cid)
    return arena


class V05SemanticsTests(unittest.TestCase):
    def test_v05_opaque_aliases_hide_own_identity_but_reveal_verifies(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = to_review(temp, "opaque-aliases", ("one", "two", "three"))
            state = arena.get("opaque-aliases")
            self.assertEqual(state["blind_order_algorithm"], "hmac-sha256-opaque-labels-v2")
            self.assertTrue(state["blind_map"])
            self.assertTrue(
                all(re.fullmatch(r"Candidate-[0-9a-f]{16,}", label) for label in state["blind_map"])
            )
            packet = arena.review_packet("opaque-aliases", "one")
            self.assertIsNone(packet["own_blind_label"])
            self.assertTrue(packet["rules"]["own_blind_label_hidden"])
            self.assertEqual(len(packet["candidate_labels"]), 2)
            arena.submit_review("opaque-aliases", "one", review_payload(packet, 71.0))
            public = arena.public_view("opaque-aliases")
            public_json = json.dumps(public, sort_keys=True)
            for label in state["blind_map"]:
                self.assertNotIn(label, public_json)
            self.assertTrue(public["blind_label_set_hidden"])
            self.assertEqual(public["blind_candidate_count"], 3)
            arena.close_voting("opaque-aliases", force=True)
            report = arena.verify_integrity("opaque-aliases")
            self.assertTrue(report["valid"], report)

    def test_v04_packet_replay_keeps_sequential_labels_and_own_label(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("v04-compat", "v0.4 compat", "Preserve v0.4 replay semantics.")
            packet["schema_version"] = "axm.challenge-arena/0.4"
            for key in (
                "hide_reviewer_own_blind_label",
                "require_revision_precondition",
                "minimum_independent_review_groups_per_candidate",
            ):
                packet["participant_policy"].pop(key, None)
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("v04-compat", participant)
            arena.lock_challenge("v04-compat")
            for participant in ("one", "two"):
                submit_candidate(arena, temp, "v04-compat", participant)
            arena.close_submissions("v04-compat")
            arena.run_deterministic_checks("v04-compat")
            arena.open_review("v04-compat")
            state = arena.get("v04-compat")
            self.assertEqual(state["blind_order_algorithm"], "hmac-sha256-sealed-seed-v1")
            self.assertEqual(sorted(state["blind_map"]), ["Candidate-01", "Candidate-02"])
            review_packet = arena.review_packet("v04-compat", "one")
            self.assertIn(review_packet["own_blind_label"], state["blind_map"])

    def test_submission_revision_requires_exact_precondition_and_rejects_stale_writer(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("revision-cas", "revision CAS", "Reject stale replacement writers.")
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("revision-cas", participant)
            arena.lock_challenge("revision-cas")
            first = submit_candidate(arena, temp, "revision-cas", "one", "first")
            source = Path(temp) / "source-revision-cas-one"
            (source / "result.txt").write_text("second", encoding="utf-8")
            with self.assertRaises(ValidationError):
                arena.submit("revision-cas", "one", source, manifest(arena, "revision-cas", "one"), replace=True)
            second = arena.submit(
                "revision-cas",
                "one",
                source,
                manifest(arena, "revision-cas", "one"),
                replace=True,
                expected_previous_submission_id=first["submission_id"],
            )
            (source / "result.txt").write_text("third", encoding="utf-8")
            with self.assertRaises(ValidationError):
                arena.submit(
                    "revision-cas",
                    "one",
                    source,
                    manifest(arena, "revision-cas", "one"),
                    replace=True,
                    expected_previous_submission_id=first["submission_id"],
                )
            self.assertEqual(
                arena.get("revision-cas")["participant_active_submission"]["one"],
                second["submission_id"],
            )

    def test_review_revision_requires_exact_precondition(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = to_review(temp, "review-revision-cas", ("one", "two"))
            packet = arena.review_packet("review-revision-cas", "one")
            first_payload = review_payload(packet, 60.0)
            first = arena.submit_review("review-revision-cas", "one", first_payload)
            revised = review_payload(packet, 80.0)
            with self.assertRaises(ValidationError):
                arena.submit_review(
                    "review-revision-cas", "one", revised, replace=True
                )
            second = arena.submit_review(
                "review-revision-cas",
                "one",
                revised,
                replace=True,
                expected_previous_review_id=first["review_id"],
            )
            with self.assertRaises(ValidationError):
                arena.submit_review(
                    "review-revision-cas",
                    "one",
                    review_payload(packet, 90.0),
                    replace=True,
                    expected_previous_review_id=first["review_id"],
                )
            self.assertEqual(
                arena.get("review-revision-cas")["participant_active_review"]["one"],
                second["review_id"],
            )

    def test_orchestration_completed_output_must_bind_to_real_participant_record(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("semantic-task-binding", "task binding", "Bind task output to real records.")
            packet["orchestration_policy"] = {
                "enabled": True,
                "task_leases_required": False,
            }
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("semantic-task-binding", participant)
            arena.lock_challenge("semantic-task-binding")
            one = submit_candidate(arena, temp, "semantic-task-binding", "one")
            two = submit_candidate(arena, temp, "semantic-task-binding", "two")
            state = arena.get("semantic-task-binding")
            self.assertTrue(verify_orchestration_state(state)["valid"])
            tampered = copy.deepcopy(state)
            task = tampered["seat_tasks"][tampered["seat_task_index"]["BUILD:one"]]
            task["completed_output"]["id"] = two["submission_id"]
            task["completed_output"]["hash"] = two["content_hash"]
            report = verify_orchestration_state(tampered)
            self.assertFalse(report["valid"])
            self.assertTrue(any("different participant" in error for error in report["errors"]), report)
            self.assertNotEqual(one["submission_id"], two["submission_id"])

    def test_no_reveal_policy_redacts_reviewer_identity_from_public_result(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            groups = {"one": "provider-a", "two": "provider-a", "three": "provider-b"}

            def mutate(packet: dict) -> None:
                packet["participant_policy"]["reveal_authors_after_close"] = False

            arena = to_review(
                temp,
                "no-reveal-result",
                ("one", "two", "three"),
                groups=groups,
                packet_mutator=mutate,
            )
            for reviewer in ("one", "two", "three"):
                packet = arena.review_packet("no-reveal-result", reviewer)
                arena.submit_review(
                    "no-reveal-result", reviewer, review_payload(packet, 72.0)
                )
            arena.close_voting("no-reveal-result")
            arena.synthesize("no-reveal-result")
            public = arena.public_view("no-reveal-result")
            result = public["result"]
            self.assertTrue(
                all(
                    row["reviewer_id"].startswith("sealed-reviewer-")
                    for row in result["reviewer_audit"]
                )
            )
            self.assertNotIn("provider-a", result["review_independence_audit"]["groups"])
            self.assertNotIn("provider-b", result["review_independence_audit"]["groups"])
            self.assertTrue(result["review_independence_audit"]["identity_details_hidden"])
            for pair in result["reviewer_similarity_audit"]["pairs"]:
                self.assertTrue(pair["reviewer_a"].startswith("sealed-reviewer-"))
                self.assertTrue(pair["reviewer_b"].startswith("sealed-reviewer-"))
                self.assertNotIn(pair["independence_group_a"], {"provider-a", "provider-b"})
                self.assertNotIn(pair["independence_group_b"], {"provider-a", "provider-b"})

    def test_malformed_bridge_import_receipt_is_rejected_not_treated_as_absent(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            receipt = Path(temp) / "IMPORT-RECEIPT.json"
            receipt.write_text('{"source_fingerprint": "x",', encoding="utf-8")
            with self.assertRaisesRegex(ValidationError, "malformed; refusing to ignore"):
                FileBridge._read_import_receipt(receipt)

            receipt.write_text('["not", "an", "object"]', encoding="utf-8")
            with self.assertRaisesRegex(ValidationError, "must contain a JSON object"):
                FileBridge._read_import_receipt(receipt)

    def test_independence_threshold_withholds_readiness_and_similarity_is_non_punitive(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            groups = {"one": "provider-a", "two": "provider-a", "three": "provider-b"}

            def mutate(packet: dict) -> None:
                packet["participant_policy"]["minimum_independent_review_groups_per_candidate"] = 2

            arena = to_review(
                temp,
                "independence",
                ("one", "two", "three"),
                groups=groups,
                packet_mutator=mutate,
            )
            for reviewer in ("one", "two", "three"):
                packet = arena.review_packet("independence", reviewer)
                arena.submit_review("independence", reviewer, review_payload(packet, 70.0))
            arena.close_voting("independence")
            result = arena.synthesize("independence")["result"]
            self.assertEqual(result["recommendation_status"], "INSUFFICIENT_EVIDENCE")
            codes = {gap["code"] for gap in result["evidence_gaps"]}
            self.assertIn("INSUFFICIENT_INDEPENDENT_REVIEW_GROUPS", codes)
            self.assertTrue(result["reviewer_similarity_audit"]["pairs"])
            self.assertFalse(result["reviewer_similarity_audit"]["automatic_exclusion"])
            self.assertEqual(
                result["review_independence_audit"]["groups"]["provider-a"],
                ["one", "two"],
            )
            self.assertEqual(
                result["review_independence_audit"]["groups"]["provider-b"],
                ["three"],
            )


if __name__ == "__main__":
    unittest.main()
