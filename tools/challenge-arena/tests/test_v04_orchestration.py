from __future__ import annotations

import copy
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from axm_challenge_arena import ChallengeArena
from axm_challenge_arena.bridge import FileBridge
from axm_challenge_arena.errors import ValidationError
from axm_challenge_arena.orchestration import (
    claim_task as claim_task_value,
    heartbeat_task as heartbeat_task_value,
    new_lease_id,
    new_lease_token,
    task_core,
    verify_orchestration_state,
)
from axm_challenge_arena.presets import generic_packet
from axm_challenge_arena.utils import atomic_write_json, read_json, sha256_json


def _packet(challenge_id: str, *, leases: bool = False) -> dict:
    packet = generic_packet(challenge_id, "v0.4 seat relay", "Exercise neutral AI-seat orchestration.")
    packet["orchestration_policy"] = {
        "enabled": True,
        "task_leases_required": leases,
        "allow_delegate_workers": False,
        "lease_seconds": 30,
        "lease_extension_seconds": 15,
        "max_total_lease_seconds": 90,
        "max_heartbeat_count": 2,
        "max_attempts": 2,
        "minimum_build_task_completion_ratio": 0.0,
        "build_budget": {
            "max_wall_seconds": 60,
            "max_input_bytes": 10_000,
            "max_output_bytes": 100,
            "max_token_units": 1_000,
            "max_tool_calls": 10,
        },
        "review_budget": {
            "max_wall_seconds": 60,
            "max_input_bytes": 100_000,
            "max_output_bytes": 100_000,
            "max_token_units": 1_000,
            "max_tool_calls": 10,
        },
    }
    return packet


def _locked_arena(
    root: str | Path,
    challenge_id: str,
    *,
    leases: bool = False,
    participants: tuple[str, ...] = ("agent-a", "agent-b"),
    packet_mutator=None,
) -> ChallengeArena:
    arena = ChallengeArena(root)
    packet = _packet(challenge_id, leases=leases)
    if packet_mutator is not None:
        packet_mutator(packet)
    arena.create_challenge(packet)
    for participant_id in participants:
        arena.register_participant(challenge_id, participant_id)
    arena.lock_challenge(challenge_id)
    return arena


def _manifest(arena: ChallengeArena, challenge_id: str, participant_id: str) -> dict:
    contract = arena.submission_contract(challenge_id, participant_id)
    return {
        "schema_version": "axm.challenge-submission/0.2",
        "challenge_id": challenge_id,
        "packet_hash": contract["packet_hash"],
        "rubric_hash": contract["rubric_hash"],
        "participant_id": participant_id,
        "artifacts": [
            {
                "path": "result.txt",
                "deliverable_id": "primary",
                "role": "primary",
                "media_type": "text/plain",
                "provenance": {"origin": "orchestration test", "rights": "CC0-1.0"},
            }
        ],
    }


def _submit(
    arena: ChallengeArena,
    root: str | Path,
    challenge_id: str,
    participant_id: str,
    *,
    token: str | None = None,
    usage: dict | None = None,
) -> dict:
    source = Path(root) / f"source-{challenge_id}-{participant_id}"
    source.mkdir(parents=True, exist_ok=True)
    (source / "result.txt").write_text(
        f"candidate output from {participant_id}\n", encoding="utf-8"
    )
    return arena.submit(
        challenge_id,
        participant_id,
        source,
        _manifest(arena, challenge_id, participant_id),
        task_token=token,
        task_usage=usage,
    )


def _review(packet: dict, score: float = 70.0) -> dict:
    criteria = [item["id"] for item in packet["peer_criteria"]]
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
                            "note": "Inspected the declared artifact.",
                        }
                    ]
                    for criterion in criteria
                },
                "strengths": ["usable"],
                "weaknesses": [],
                "risks": [],
                "merge_worthy": [],
            }
            for label in packet["candidate_labels"]
        },
        "ranking_tiers": [[label] for label in packet["candidate_labels"]],
        "ranking": list(packet["candidate_labels"]),
        "overall_reason": "Grounded seat-relay fixture review.",
    }


class V04OrchestrationTests(unittest.TestCase):
    def test_generated_lease_token_is_cli_safe_even_when_entropy_starts_with_dash(self) -> None:
        from axm_challenge_arena.orchestration import new_lease_token

        with mock.patch(
            "axm_challenge_arena.orchestration.secrets.token_urlsafe",
            return_value="-option_like_secret_value_with_enough_entropy",
        ):
            token = new_lease_token()
        self.assertTrue(token.startswith("lease_"))
        self.assertFalse(token.startswith("-"))
        self.assertNotIn(" ", token)

    def test_lock_creates_equal_build_tasks_and_hash_bound_plan(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "equal-build-tasks")
            state = arena.get("equal-build-tasks")
            tasks = [
                task
                for task in state["seat_tasks"].values()
                if task["phase"] == "BUILD"
            ]
            self.assertEqual(len(tasks), 2)
            self.assertEqual(tasks[0]["budget"], tasks[1]["budget"])
            self.assertEqual(tasks[0]["lease_policy"], tasks[1]["lease_policy"])
            plan = state["seat_task_plans"]["BUILD"]
            self.assertEqual(plan["task_count"], 2)
            self.assertEqual(plan["required_task_count"], 2)
            self.assertEqual(
                plan["task_plan_hash"],
                sha256_json({key: value for key, value in plan.items() if key != "task_plan_hash"}),
            )
            self.assertTrue(arena.verify_integrity("equal-build-tasks")["valid"])

    def test_legacy_packet_does_not_silently_gain_orchestration(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("legacy-no-relay", "Legacy", "Preserve legacy behavior.")
            packet["schema_version"] = "axm.challenge-arena/0.3"
            arena.create_challenge(packet)
            arena.register_participant("legacy-no-relay", "one")
            arena.register_participant("legacy-no-relay", "two")
            state = arena.lock_challenge("legacy-no-relay")
            self.assertFalse(state["packet"]["orchestration_policy"]["enabled"])
            self.assertEqual(state["seat_tasks"], {})
            self.assertEqual(state["seat_task_plans"], {})

    def test_claim_returns_token_once_and_only_hash_is_stored(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "hashed-token", leases=True)
            task_id = arena.get("hashed-token")["seat_task_index"]["BUILD:agent-a"]
            claimed = arena.claim_task("hashed-token", task_id, worker_id="agent-a")
            token = claimed["lease_token"]
            private_state = arena.get("hashed-token")
            self.assertNotIn(token, str(private_state))
            private_task = private_state["seat_tasks"][task_id]
            self.assertEqual(len(private_task["active_lease"]["lease_token_hash"]), 64)
            public = arena.list_tasks("hashed-token")["tasks"][task_id]
            self.assertNotIn("lease_token_hash", public["active_lease"])

    def test_delegate_worker_is_rejected_unless_locked_policy_allows_it(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "delegate-rejected", leases=True)
            task_id = arena.get("delegate-rejected")["seat_task_index"]["BUILD:agent-a"]
            with self.assertRaises(ValidationError):
                arena.claim_task("delegate-rejected", task_id, worker_id="agent-b")

    def test_wrong_token_cannot_heartbeat_or_complete(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "wrong-token", leases=True)
            task_id = arena.get("wrong-token")["seat_task_index"]["BUILD:agent-a"]
            arena.claim_task("wrong-token", task_id, worker_id="agent-a")
            with self.assertRaises(ValidationError):
                arena.heartbeat_task("wrong-token", task_id, "not-the-token")
            with self.assertRaises(ValidationError):
                _submit(arena, temp, "wrong-token", "agent-a", token="not-the-token")
            submissions_root = arena.store.challenge_dir("wrong-token") / "submissions"
            self.assertFalse(submissions_root.exists() and any(submissions_root.iterdir()))

    def test_lease_and_heartbeat_inputs_reject_bool_and_fractional_values(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "strict-lease-inputs", leases=True)
            task = copy.deepcopy(
                arena.get("strict-lease-inputs")["seat_tasks"]["build-agent-a"]
            )
            with self.assertRaises(ValidationError):
                claim_task_value(
                    task,
                    worker_id="agent-a",
                    token=new_lease_token(),
                    lease_id=new_lease_id(task["task_id"]),
                    lease_seconds=True,
                )
            token = new_lease_token()
            claim_task_value(
                task,
                worker_id="agent-a",
                token=token,
                lease_id=new_lease_id(task["task_id"]),
                lease_seconds=30,
            )
            with self.assertRaises(ValidationError):
                heartbeat_task_value(task, token=token, extension_seconds=1.5)

    def test_heartbeat_count_and_total_expiry_are_capped(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "heartbeat-cap", leases=True)
            task_id = arena.get("heartbeat-cap")["seat_task_index"]["BUILD:agent-a"]
            claimed = arena.claim_task("heartbeat-cap", task_id, worker_id="agent-a")
            token = claimed["lease_token"]
            first = arena.heartbeat_task(
                "heartbeat-cap", task_id, token, extension_seconds=30
            )
            second = arena.heartbeat_task(
                "heartbeat-cap", task_id, token, extension_seconds=30
            )
            self.assertEqual(second["expires_at"], second["max_expires_at"])
            self.assertNotEqual(first["expires_at"], claimed["lease"]["expires_at"])
            with self.assertRaises(ValidationError):
                arena.heartbeat_task("heartbeat-cap", task_id, token)

    def test_retryable_failure_returns_ready_then_terminal_failure_dead_letters(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "retry-dead-letter", leases=True)
            task_id = arena.get("retry-dead-letter")["seat_task_index"]["BUILD:agent-a"]
            first = arena.claim_task("retry-dead-letter", task_id, worker_id="agent-a")
            failed = arena.fail_task(
                "retry-dead-letter",
                task_id,
                first["lease_token"],
                failure_class="INFRASTRUCTURE",
                detail="temporary local runner failure",
                retryable=True,
            )
            self.assertEqual(failed["status"], "READY")
            second = arena.claim_task("retry-dead-letter", task_id, worker_id="agent-a")
            terminal = arena.fail_task(
                "retry-dead-letter",
                task_id,
                second["lease_token"],
                failure_class="MODEL_UNAVAILABLE",
                detail="seat unavailable",
                retryable=False,
            )
            self.assertEqual(terminal["status"], "DEAD_LETTER")
            report = arena.list_tasks("retry-dead-letter")["report"]
            self.assertEqual(report["status_counts"]["DEAD_LETTER"], 1)
            self.assertFalse(report["automatic_score_effect"])

    def test_expired_lease_is_reaped_without_becoming_a_candidate_score(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(
                temp,
                "expired-reap",
                leases=True,
                packet_mutator=lambda packet: packet["orchestration_policy"].update(
                    {"lease_seconds": 10, "max_total_lease_seconds": 20}
                ),
            )
            task_id = arena.get("expired-reap")["seat_task_index"]["BUILD:agent-a"]
            with mock.patch(
                "axm_challenge_arena.orchestration.utc_now",
                return_value="2026-08-15T00:00:00Z",
            ):
                arena.claim_task("expired-reap", task_id, worker_id="agent-a")
            with mock.patch(
                "axm_challenge_arena.orchestration.utc_now",
                return_value="2026-08-15T00:00:11Z",
            ):
                result = arena.reap_tasks("expired-reap")
            self.assertTrue(result["changed"])
            task = arena.get("expired-reap")["seat_tasks"][task_id]
            self.assertEqual(task["status"], "READY")
            self.assertEqual(task["attempts"][0]["status"], "EXPIRED")
            self.assertFalse(result["report"]["automatic_score_effect"])

    def test_required_lease_blocks_submission_until_claimed(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "lease-required", leases=True)
            with self.assertRaises(ValidationError):
                _submit(arena, temp, "lease-required", "agent-a")
            task_id = arena.get("lease-required")["seat_task_index"]["BUILD:agent-a"]
            claimed = arena.claim_task("lease-required", task_id, worker_id="agent-a")
            record = _submit(
                arena,
                temp,
                "lease-required",
                "agent-a",
                token=claimed["lease_token"],
            )
            self.assertEqual(record["participant_id"], "agent-a")
            self.assertEqual(arena.get("lease-required")["seat_tasks"][task_id]["status"], "COMPLETED")

    def test_completion_receipt_is_immutable_and_budget_overrun_is_only_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "budget-evidence", leases=True)
            task_id = arena.get("budget-evidence")["seat_task_index"]["BUILD:agent-a"]
            claimed = arena.claim_task("budget-evidence", task_id, worker_id="agent-a")
            _submit(
                arena,
                temp,
                "budget-evidence",
                "agent-a",
                token=claimed["lease_token"],
                usage={
                    "output_bytes": 10_000,
                    "measurement_source": "test-meter",
                    "notes": "private runner detail",
                },
            )
            task = arena.get("budget-evidence")["seat_tasks"][task_id]
            evaluation = task["completed_output"]["budget_evaluation"]
            self.assertFalse(evaluation["within_locked_budget"])
            self.assertFalse(evaluation["automatic_score_effect"])
            receipts = list(
                (arena.store.challenge_dir("budget-evidence") / "orchestration" / "receipts").glob("*.json")
            )
            self.assertEqual(len(receipts), 1)
            public_task = arena.list_tasks("budget-evidence")["tasks"][task_id]
            self.assertNotIn("notes", public_task["completed_output"]["usage"])
            private_task = arena.list_tasks("budget-evidence", include_private=True)["tasks"][task_id]
            self.assertEqual(private_task["completed_output"]["usage"]["notes"], "private runner detail")

    def test_non_lease_mode_completes_directly_for_simple_local_seats(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "direct-seat", leases=False)
            _submit(arena, temp, "direct-seat", "agent-a")
            task = arena.get("direct-seat")["seat_tasks"]["build-agent-a"]
            self.assertEqual(task["status"], "COMPLETED")
            self.assertEqual(task["attempts"][0]["status"], "COMPLETED_DIRECT")

    def test_review_tasks_are_bound_to_assignments_and_can_use_leases(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "review-seat", leases=True)
            for participant_id in ("agent-a", "agent-b"):
                task_id = arena.get("review-seat")["seat_task_index"][f"BUILD:{participant_id}"]
                claimed = arena.claim_task("review-seat", task_id, worker_id=participant_id)
                _submit(
                    arena,
                    temp,
                    "review-seat",
                    participant_id,
                    token=claimed["lease_token"],
                )
            arena.close_submissions("review-seat")
            arena.run_deterministic_checks("review-seat")
            arena.open_review("review-seat")
            state = arena.get("review-seat")
            self.assertIn("REVIEW", state["seat_task_plans"])
            for reviewer_id in ("agent-a", "agent-b"):
                packet = arena.review_packet("review-seat", reviewer_id)
                seat_task = packet["seat_task"]
                self.assertEqual(
                    seat_task["assigned_candidate_labels"],
                    sorted(packet["candidate_labels"]),
                )
                claimed = arena.claim_task(
                    "review-seat", seat_task["task_id"], worker_id=reviewer_id
                )
                arena.submit_review(
                    "review-seat",
                    reviewer_id,
                    _review(packet),
                    task_token=claimed["lease_token"],
                    task_usage={"output_bytes": 500},
                )
            self.assertTrue(arena.verify_integrity("review-seat")["valid"])

    def test_live_public_view_hides_task_author_mapping_and_private_hashes(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "public-relay", leases=True)
            task_id = arena.get("public-relay")["seat_task_index"]["BUILD:agent-a"]
            arena.claim_task("public-relay", task_id, worker_id="agent-a")
            live = arena.public_view("public-relay")
            self.assertEqual(live["seat_tasks"]["details_hidden"], True)
            self.assertNotIn("build-agent-a", str(live["seat_tasks"]))
            self.assertEqual(live["seat_task_index"], {})
            self.assertNotIn("lease_token_hash", str(live))
            self.assertIn("report", live["seat_tasks"])

    def test_late_registration_adds_task_without_rewriting_existing_task_core(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(
                temp,
                "late-seat",
                packet_mutator=lambda packet: packet["participant_policy"].update(
                    {"allow_late_registration": True}
                ),
            )
            before = arena.get("late-seat")
            old_core = copy.deepcopy(before["seat_tasks"]["build-agent-a"])
            old_core = task_core(old_core)
            arena.register_participant("late-seat", "agent-c")
            after = arena.get("late-seat")
            self.assertIn("build-agent-c", after["seat_tasks"])
            self.assertEqual(task_core(after["seat_tasks"]["build-agent-a"]), old_core)
            self.assertEqual(after["seat_task_plans"]["BUILD"]["task_count"], 3)
            self.assertTrue(arena.verify_integrity("late-seat")["valid"])

    def test_low_task_completion_withholds_recommendation_not_candidate_scores(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            def mutate(packet: dict) -> None:
                packet["orchestration_policy"]["minimum_build_task_completion_ratio"] = 1.0

            arena = _locked_arena(
                temp,
                "completion-threshold",
                participants=("agent-a", "agent-b", "agent-c"),
                packet_mutator=mutate,
            )
            _submit(arena, temp, "completion-threshold", "agent-a")
            _submit(arena, temp, "completion-threshold", "agent-b")
            arena.close_submissions("completion-threshold")
            arena.run_deterministic_checks("completion-threshold")
            arena.open_review("completion-threshold")
            for reviewer_id in ("agent-a", "agent-b", "agent-c"):
                packet = arena.review_packet("completion-threshold", reviewer_id)
                arena.submit_review(
                    "completion-threshold", reviewer_id, _review(packet)
                )
            arena.close_voting("completion-threshold")
            result = arena.synthesize("completion-threshold")["result"]
            codes = {gap["code"] for gap in result["evidence_gaps"]}
            self.assertIn("LOW_BUILD_TASK_COMPLETION", codes)
            self.assertEqual(result["recommendation_status"], "INSUFFICIENT_EVIDENCE")
            self.assertIsNone(result["provisional_winner"])
            self.assertFalse(result["orchestration_evidence"]["automatic_score_effect"])

    def test_cancelled_task_stays_operational_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "cancel-seat", leases=True)
            task_id = arena.get("cancel-seat")["seat_task_index"]["BUILD:agent-a"]
            arena.cancel_task("cancel-seat", task_id, reason="operator withdrew this seat")
            task = arena.get("cancel-seat")["seat_tasks"][task_id]
            self.assertEqual(task["status"], "CANCELLED")
            self.assertEqual(task["cancelled"]["reason"], "operator withdrew this seat")
            self.assertFalse(arena.list_tasks("cancel-seat")["report"]["automatic_score_effect"])
            with self.assertRaises(ValidationError):
                arena.claim_task("cancel-seat", task_id, worker_id="agent-a")

    def test_self_rehashed_task_core_drift_is_detected_semantically(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "semantic-task-integrity")
            state = arena.get("semantic-task-integrity")
            task = state["seat_tasks"]["build-agent-a"]
            task["budget"]["max_wall_seconds"] = 999999
            task["task_core_hash"] = sha256_json(task_core(task))
            plan = state["seat_task_plans"]["BUILD"]
            plan["task_core_hashes"]["build-agent-a"] = task["task_core_hash"]
            plan["budget_hashes"]["build-agent-a"] = sha256_json(task["budget"])
            plan["task_plan_hash"] = sha256_json(
                {key: value for key, value in plan.items() if key != "task_plan_hash"}
            )
            report = verify_orchestration_state(state)
            self.assertFalse(report["valid"])
            self.assertTrue(
                any("does not reproduce" in error for error in report["errors"]),
                report,
            )

    def test_bridge_rejects_receipt_for_another_task(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "bridge-task-binding", leases=True)
            bridge = FileBridge(arena, Path(temp) / "bridge")
            bridge.export_build_packets("bridge-task-binding")
            incoming = (
                bridge.incoming / "bridge-task-binding" / "build" / "agent-a"
            )
            incoming.mkdir(parents=True)
            artifacts = incoming / "artifacts"
            artifacts.mkdir()
            (artifacts / "result.txt").write_text("candidate", encoding="utf-8")
            atomic_write_json(
                incoming / "submission.json",
                _manifest(arena, "bridge-task-binding", "agent-a"),
            )
            atomic_write_json(
                incoming / "seat-receipt.json",
                {
                    "schema_version": "axm.challenge-seat-worker-return/0.4",
                    "task_id": "build-agent-b",
                    "task_token": "wrong-task-token",
                    "usage": {},
                },
            )
            with self.assertRaises(ValidationError):
                bridge.import_build_submission("bridge-task-binding", "agent-a")

    def test_bridge_imports_matching_claimed_receipt(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = _locked_arena(temp, "bridge-seat-import", leases=True)
            bridge = FileBridge(arena, Path(temp) / "bridge")
            bridge.export_build_packets("bridge-seat-import")
            task_id = arena.get("bridge-seat-import")["seat_task_index"]["BUILD:agent-a"]
            claimed = arena.claim_task("bridge-seat-import", task_id, worker_id="agent-a")
            incoming = bridge.incoming / "bridge-seat-import" / "build" / "agent-a"
            incoming.mkdir(parents=True)
            artifacts = incoming / "artifacts"
            artifacts.mkdir()
            (artifacts / "result.txt").write_text("candidate", encoding="utf-8")
            atomic_write_json(
                incoming / "submission.json",
                _manifest(arena, "bridge-seat-import", "agent-a"),
            )
            atomic_write_json(
                incoming / "seat-receipt.json",
                {
                    "schema_version": "axm.challenge-seat-worker-return/0.4",
                    "task_id": task_id,
                    "task_token": claimed["lease_token"],
                    "usage": {"output_bytes": 9, "measurement_source": "bridge-test"},
                },
            )
            record = bridge.import_build_submission("bridge-seat-import", "agent-a")
            self.assertEqual(record["bridge_import_status"], "IMPORTED")
            self.assertEqual(arena.get("bridge-seat-import")["seat_tasks"][task_id]["status"], "COMPLETED")


if __name__ == "__main__":
    unittest.main()
