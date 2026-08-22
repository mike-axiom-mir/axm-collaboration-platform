from __future__ import annotations

import copy
import json
import os
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

from axm_challenge_arena import ChallengeArena, verify_evidence_bundle
from axm_challenge_arena import bundle as bundle_module
from axm_challenge_arena.bridge import FileBridge
from axm_challenge_arena.demo import run_demo
from axm_challenge_arena.errors import IntegrityError, ValidationError
from axm_challenge_arena.orchestration import public_task
from axm_challenge_arena.presets import generic_packet
from axm_challenge_arena.utils import atomic_write_json, read_json
from axm_challenge_arena.voting import aggregate_votes


def _manifest(
    arena: ChallengeArena,
    challenge_id: str,
    participant_id: str,
    *,
    path: str,
    media_type: str = "application/octet-stream",
) -> dict:
    contract = arena.submission_contract(challenge_id, participant_id)
    return {
        "schema_version": "axm.challenge-submission/0.2",
        "challenge_id": challenge_id,
        "packet_hash": contract["packet_hash"],
        "rubric_hash": contract["rubric_hash"],
        "participant_roster_hash": contract["participant_roster_hash"],
        "participant_id": participant_id,
        "artifacts": [
            {
                "path": path,
                "deliverable_id": "primary",
                "role": "primary",
                "media_type": media_type,
                "provenance": {"origin": "v0.4 resilience test", "rights": "CC0"},
            }
        ],
    }


def _build_only_arena(
    root: str | Path,
    challenge_id: str,
    *,
    participant_id: str = "builder",
    packet: dict | None = None,
) -> ChallengeArena:
    arena = ChallengeArena(root)
    selected_packet = copy.deepcopy(
        packet
        or generic_packet(
            challenge_id,
            "v0.4 resilience",
            "Exercise bounded recovery and evidence preservation.",
        )
    )
    arena.create_challenge(selected_packet)
    arena.register_participant(challenge_id, participant_id)
    second_participant = "support-seat" if participant_id != "support-seat" else "support-seat-2"
    arena.register_participant(challenge_id, second_participant)
    arena.lock_challenge(challenge_id)
    return arena


def _synthetic_vote_state(*, assignment_mode: str, include_third: bool = False) -> tuple[dict, dict]:
    packet = generic_packet(
        "vote-resilience",
        "vote resilience",
        "Do not manufacture a winner from unequal evidence.",
    )
    labels = ["Candidate-A", "Candidate-B"] + (["Candidate-C"] if include_third else [])
    blind_map = {label: f"sub-{label[-1].lower()}" for label in labels}
    peer_ids = [
        criterion["id"]
        for criterion in packet["rubric"]
        if criterion.get("source") == "peer"
    ]
    evaluations = {
        label: {
            "scores": {criterion_id: 80 for criterion_id in peer_ids},
            "evidence_refs": {
                criterion_id: [
                    {"kind": "observation", "note": "Synthetic locked fixture evidence."}
                ]
                for criterion_id in peer_ids
            },
        }
        for label in labels[:2]
    }
    ranking = ["Candidate-A", "Candidate-B"]
    review = {
        "status": "ACTIVE",
        "reviewer_id": "reviewer",
        "evaluations": evaluations,
        "ranking": ranking,
        "ranking_tiers": [["Candidate-A"], ["Candidate-B"]],
        "overall_reason": "Fixture preference with equal rubric scores.",
    }
    tests = {
        submission_id: {
            "eligible": True,
            "summary": {"total": 1, "passed": 1},
            "criterion_scores": {
                "contract_compliance": {"score": 100, "coverage": 1}
            },
        }
        for submission_id in blind_map.values()
    }
    assignments = {"reviewer": labels[:2]}
    candidate_coverage = {label: (1 if label in labels[:2] else 0) for label in labels}
    unmet = {label: 1 for label, coverage in candidate_coverage.items() if coverage < 1}
    state = {
        "blind_map": blind_map,
        "submissions": {
            submission_id: {"status": "ACTIVE", "content_hash": submission_id}
            for submission_id in blind_map.values()
        },
        "test_results": tests,
        "reviews": {"review-1": review},
        "participants": {
            "reviewer": {
                "can_review": True,
                "review_required": True,
                "can_submit": False,
            }
        },
        "participant_active_review": {"reviewer": "review-1"},
        "review_assignments": assignments,
        "review_assignment_report": {
            "schema_version": "axm.challenge-review-assignment/0.3",
            "mode": assignment_mode,
            "candidate_target": 1,
            "candidate_coverage": candidate_coverage,
            "all_candidate_targets_met": not unmet,
            "unmet_candidate_targets": unmet,
            "assignments": assignments,
        },
    }
    return packet, state


class V04ResilienceTests(unittest.TestCase):
    def test_checkpoint_tampering_invalidates_integrity(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            run_demo(temp)
            arena = ChallengeArena(temp)
            challenge_id = "arena-demo-001"
            checkpoint = next(
                iter(sorted(arena.store.checkpoints_dir(challenge_id).glob("*.json")))
            )
            value = read_json(checkpoint)
            value["state"]["title_for_tamper_test"] = "changed after checkpoint"
            atomic_write_json(checkpoint, value)
            report = arena.verify_integrity(challenge_id)
            self.assertFalse(report["valid"])
            self.assertTrue(
                any("checkpoint" in error.lower() for error in report["errors"]),
                report,
            )

    def test_legacy_event_migration_resumes_exactly_after_interruption(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _build_only_arena(temp, "migration-resume")
            store = arena.store
            challenge_id = "migration-resume"
            expected_events = [
                json.loads(line)
                for line in store.events_path(challenge_id).read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
            for path in store.event_files_dir(challenge_id).glob("*.json"):
                path.unlink()

            original = store._write_event_file
            calls = 0

            def interrupted(cid: str, event: dict) -> None:
                nonlocal calls
                original(cid, event)
                calls += 1
                if calls == 1:
                    raise RuntimeError("simulated power loss")

            with mock.patch.object(store, "_write_event_file", side_effect=interrupted):
                with self.assertRaises(RuntimeError):
                    store.migrate_legacy_events(challenge_id)

            marker = store.legacy_migration_path(challenge_id)
            self.assertTrue(marker.is_file())
            self.assertEqual(len(list(store.event_files_dir(challenge_id).glob("*.json"))), 1)

            migrated = store.migrate_legacy_events(challenge_id)
            self.assertEqual(migrated, len(expected_events) - 1)
            self.assertFalse(marker.exists())
            self.assertEqual(store.read_events(challenge_id), expected_events)
            self.assertTrue(store.verify_event_chain(challenge_id)["valid"])

    def test_export_inside_managed_evidence_is_blocked_without_overwrite(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            run_demo(temp)
            arena = ChallengeArena(temp)
            challenge_id = "arena-demo-001"
            state_path = arena.store.state_path(challenge_id)
            original = state_path.read_bytes()
            destination = arena.store.challenge_dir(challenge_id) / "state.json"
            with self.assertRaises(ValidationError):
                arena.export_evidence_bundle(challenge_id, destination)
            self.assertEqual(state_path.read_bytes(), original)
            self.assertTrue(arena.verify_integrity(challenge_id)["valid"])

    def test_large_bundle_is_streamed_reproducibly_and_verifies_standalone(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _build_only_arena(temp, "large-bundle")
            source = Path(temp) / "large-source"
            source.mkdir()
            payload = os.urandom(5 * 1024 * 1024)
            (source / "payload.bin").write_bytes(payload)
            arena.submit(
                "large-bundle",
                "builder",
                source,
                _manifest(arena, "large-bundle", "builder", path="payload.bin"),
            )
            first = Path(temp) / "first.zip"
            second = Path(temp) / "second.zip"
            one = arena.export_evidence_bundle("large-bundle", first)
            two = arena.export_evidence_bundle("large-bundle", second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            self.assertEqual(one["sha256"], two["sha256"])
            verified = verify_evidence_bundle(first)
            self.assertTrue(verified["valid"], verified)
            self.assertGreaterEqual(one["source_bytes"], len(payload))
            self.assertTrue(one["streaming_copy"])

    def test_tampered_bundle_entry_fails_standalone_verification(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _build_only_arena(temp, "tampered-bundle")
            original = Path(temp) / "original.zip"
            arena.export_evidence_bundle("tampered-bundle", original)
            tampered = Path(temp) / "tampered.zip"
            with zipfile.ZipFile(original, "r") as source, zipfile.ZipFile(
                tampered, "w", compression=zipfile.ZIP_DEFLATED
            ) as target:
                for info in source.infolist():
                    data = source.read(info.filename)
                    if info.filename == "challenge/state.json":
                        data += b"\n"
                    target.writestr(info.filename, data)
            report = verify_evidence_bundle(tampered)
            self.assertFalse(report["valid"])
            self.assertTrue(
                any("state.json" in error or "SHA-256" in error for error in report["errors"]),
                report,
            )

    def test_source_mutation_during_stream_aborts_and_leaves_no_bundle(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _build_only_arena(temp, "mutation-export")
            source = Path(temp) / "mutation-source"
            source.mkdir()
            (source / "result.bin").write_bytes(os.urandom(1024 * 1024))
            submission = arena.submit(
                "mutation-export",
                "builder",
                source,
                _manifest(arena, "mutation-export", "builder", path="result.bin"),
            )
            stored_artifact = (
                arena.store.challenge_dir("mutation-export")
                / submission["relative_directory"]
                / "artifacts"
                / "result.bin"
            )
            destination = Path(temp) / "must-not-exist.zip"
            original_stream = bundle_module._stream_entry
            mutated = False

            def mutate_then_stream(archive: zipfile.ZipFile, entry: object) -> None:
                nonlocal mutated
                if not mutated:
                    stored_artifact.write_bytes(stored_artifact.read_bytes() + b"x")
                    mutated = True
                original_stream(archive, entry)  # type: ignore[arg-type]

            with mock.patch.object(bundle_module, "_stream_entry", side_effect=mutate_then_stream):
                with self.assertRaises(IntegrityError):
                    arena.export_evidence_bundle("mutation-export", destination)
            self.assertTrue(mutated)
            self.assertFalse(destination.exists())
            self.assertFalse(any(Path(temp).glob(".must-not-exist.zip.*.tmp")))

    def test_bridge_rejects_outside_paths_and_managed_storage(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            with self.assertRaises(ValidationError):
                FileBridge(arena, arena.store.challenges_root / "bridge")
            boundary = Path(temp) / "boundary"
            boundary.mkdir()
            outside = Path(temp) / "outside" / "item.json"
            with self.assertRaises(IntegrityError):
                FileBridge._assert_no_symlink_path(outside, boundary)

    def test_incomplete_comparative_coverage_withholds_winner(self) -> None:
        packet, state = _synthetic_vote_state(assignment_mode="balanced", include_third=True)
        result = aggregate_votes(packet, state)
        self.assertIsNone(result["provisional_winner"])
        self.assertEqual(result["recommendation_status"], "INSUFFICIENT_EVIDENCE")
        gap = next(
            gap
            for gap in result["evidence_gaps"]
            if gap["code"] == "INCOMPLETE_COMPARATIVE_REVIEW_COVERAGE"
        )
        self.assertTrue(
            any(item["blind_label"] == "Candidate-C" for item in gap["deficits"]),
            gap,
        )

    def test_balanced_ranking_cannot_break_equal_rubric_score(self) -> None:
        packet, state = _synthetic_vote_state(assignment_mode="balanced")
        result = aggregate_votes(packet, state)
        self.assertFalse(result["ranking_comparability"]["tie_break_eligible"])
        self.assertEqual(result["recommendation_status"], "EXACT_TIE")
        self.assertIsNone(result["provisional_winner"])
        self.assertEqual(result["exact_tie_labels"], ["Candidate-A", "Candidate-B"])

    def test_all_to_all_ranking_can_break_equal_rubric_score(self) -> None:
        packet, state = _synthetic_vote_state(assignment_mode="all")
        result = aggregate_votes(packet, state)
        self.assertTrue(result["ranking_comparability"]["tie_break_eligible"], result)
        self.assertEqual(result["provisional_winner"], "Candidate-A")
        self.assertEqual(result["recommendation_status"], "READY_FOR_HUMAN_DECISION")

    def test_task_tokens_are_private_and_budget_overrun_is_non_punitive(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            packet = generic_packet(
                "task-budget",
                "task budget",
                "Record operational use without turning cost into quality.",
            )
            packet["orchestration_policy"] = {
                "task_leases_required": True,
                "max_heartbeat_count": 1,
                "build_budget": {"max_output_bytes": 10},
            }
            arena = _build_only_arena(temp, "task-budget", packet=packet)
            task_id = next(
                task_id
                for task_id, task in arena.list_tasks("task-budget", phase="BUILD")["tasks"].items()
                if task["participant_id"] == "builder"
            )
            lease = arena.claim_task("task-budget", task_id, worker_id="builder")
            token = lease["lease_token"]

            private_state = arena.get("task-budget")
            self.assertNotIn(token, json.dumps(private_state, sort_keys=True))
            self.assertIn(
                "lease_token_hash",
                private_state["seat_tasks"][task_id]["active_lease"],
            )
            public = arena.list_tasks("task-budget", phase="BUILD")
            self.assertNotIn("lease_token_hash", json.dumps(public, sort_keys=True))
            with self.assertRaises(ValidationError):
                arena.heartbeat_task("task-budget", task_id, "wrong-token")
            arena.heartbeat_task("task-budget", task_id, token, extension_seconds=1)
            with self.assertRaises(ValidationError):
                arena.heartbeat_task("task-budget", task_id, token, extension_seconds=1)

            source = Path(temp) / "task-source"
            source.mkdir()
            (source / "result.bin").write_bytes(b"x" * 100)
            submission = arena.submit(
                "task-budget",
                "builder",
                source,
                _manifest(arena, "task-budget", "builder", path="result.bin"),
                task_token=token,
                task_usage={
                    "output_bytes": 999,
                    "wall_seconds": 2,
                    "measurement_source": "test meter",
                    "notes": "private worker note",
                },
            )
            state = arena.get("task-budget")
            task = state["seat_tasks"][task_id]
            self.assertEqual(task["status"], "COMPLETED")
            self.assertTrue(task["completed_output"]["budget_evaluation"]["signals"])
            self.assertFalse(task["completed_output"]["budget_evaluation"]["automatic_score_effect"])
            self.assertFalse(task["completed_output"]["budget_evaluation"]["within_locked_budget"])
            self.assertEqual(
                state["submissions"][submission["submission_id"]]["status"], "ACTIVE"
            )
            public_task_view = arena.list_tasks("task-budget", phase="BUILD")["tasks"][task_id]
            self.assertNotIn("private worker note", json.dumps(public_task_view))
            self.assertTrue(arena.verify_integrity("task-budget")["valid"])

    def test_task_core_tampering_is_detected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _build_only_arena(temp, "task-tamper")
            state = arena.get("task-tamper")
            task_id = next(iter(state["seat_tasks"]))
            state["seat_tasks"][task_id]["budget"]["max_output_bytes"] = 123
            arena.store.save("task-tamper", state)
            report = arena.verify_integrity("task-tamper")
            self.assertFalse(report["valid"])
            self.assertTrue(
                any("orchestration" in error and "core hash" in error for error in report["errors"]),
                report,
            )

    def test_public_task_redacts_nested_usage_notes(self) -> None:
        task = {
            "active_lease": {"lease_token_hash": "a" * 64},
            "attempts": [
                {
                    "completion": {
                        "notes": "outer private",
                        "usage": {"notes": "nested private"},
                    }
                }
            ],
            "completed_output": {
                "notes": "completed private",
                "usage": {"notes": "completed nested private"},
            },
        }
        redacted = public_task(copy.deepcopy(task))
        encoded = json.dumps(redacted)
        self.assertNotIn("private", encoded)
        self.assertNotIn("lease_token_hash", encoded)


if __name__ == "__main__":
    unittest.main()
