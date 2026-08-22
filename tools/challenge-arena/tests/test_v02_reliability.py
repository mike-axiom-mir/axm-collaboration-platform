from __future__ import annotations

import copy
import json
import os
import tempfile
import threading
import unittest
from unittest import mock
import urllib.request
import zipfile
from pathlib import Path

from axm_challenge_arena import ChallengeArena, build_receipt, load_schema, schema_names, __version__
from axm_challenge_arena.bridge import FileBridge
from axm_challenge_arena.demo import run_demo
from axm_challenge_arena.errors import IntegrityError, StateError, ValidationError
from axm_challenge_arena.presets import generic_packet
from axm_challenge_arena.integrations import packet_from_module_job
from axm_challenge_arena.server import build_server
from axm_challenge_arena.utils import (
    atomic_write_bytes,
    atomic_write_json,
    sha256_bytes,
    sha256_file,
    sha256_json,
)
from axm_challenge_arena.validators import build_default_registry


def manifest_for(arena: ChallengeArena, challenge_id: str, participant_id: str, *, path: str = "result.txt") -> dict:
    state = arena.get(challenge_id)
    return {
        "challenge_id": challenge_id,
        "packet_hash": state["packet_hash"],
        "rubric_hash": state["rubric_hash"],
        "participant_id": participant_id,
        "summary": f"submission from {participant_id}",
        "artifacts": [
            {
                "path": path,
                "deliverable_id": "primary",
                "role": "primary",
                "media_type": "text/plain",
                "provenance": {"origin": "test", "rights": "CC0"},
            }
        ],
    }


def build_to_review(
    root: str,
    challenge_id: str,
    *,
    packet: dict | None = None,
    contents: dict[str, str] | None = None,
) -> ChallengeArena:
    arena = ChallengeArena(root)
    packet = packet or generic_packet(challenge_id, "Reliability round", "Exercise the Arena safely.")
    arena.create_challenge(packet)
    contents = contents or {"one": "one", "two": "two"}
    for participant in contents:
        arena.register_participant(challenge_id, participant)
    arena.lock_challenge(challenge_id)
    for participant, text in contents.items():
        source = Path(root) / f"source-{challenge_id}-{participant}"
        source.mkdir(parents=True)
        (source / "result.txt").write_text(text, encoding="utf-8")
        arena.submit(challenge_id, participant, source, manifest_for(arena, challenge_id, participant))
    arena.close_submissions(challenge_id)
    arena.run_deterministic_checks(challenge_id)
    arena.open_review(challenge_id)
    return arena


def submit_equal_reviews(arena: ChallengeArena, challenge_id: str, score: float = 50.0) -> None:
    state = arena.get(challenge_id)
    for reviewer_id, participant in sorted(state["participants"].items()):
        if not participant.get("can_review", True):
            continue
        packet = arena.review_packet(challenge_id, reviewer_id)
        scores = {criterion["id"]: score for criterion in packet["peer_criteria"]}
        arena.submit_review(
            challenge_id,
            reviewer_id,
            {
                "schema_version": "axm.challenge-review/0.4",
                "rubric_hash": packet["rubric_hash"],
                "assignment_hash": packet["assignment_hash"],
                "review_packet_hash": packet["review_packet_hash"],
                "evaluations": {
                    label: {
                        "scores": scores,
                        "evidence_refs": {
                            criterion_id: [{
                                "kind": "artifact",
                                "path": "result.txt",
                                "note": "equal-evidence fixture inspected the declared artifact",
                            }]
                            for criterion_id in scores
                        },
                        "strengths": ["works"],
                        "weaknesses": [],
                        "risks": [],
                        "merge_worthy": [],
                    }
                    for label in packet["candidate_labels"]
                },
                "ranking_tiers": [[label] for label in packet["candidate_labels"]],
                "ranking": list(packet["candidate_labels"]),
                "overall_reason": "equal evidence",
            },
        )


def build_synthesized_with_sealed_input(
    root: str,
    challenge_id: str,
) -> ChallengeArena:
    arena = ChallengeArena(root)
    packet = generic_packet(
        challenge_id,
        "Sealed-input parent",
        "Preserve and reuse exact challenge-owned source evidence.",
    )
    packet["inputs"] = [
        {
            "id": "brief",
            "kind": "directory",
            "required": True,
            "description": "Parent source brief that every follow-up must inherit exactly.",
        }
    ]
    arena.create_challenge(packet)
    source = Path(root) / f"source-{challenge_id}-brief"
    (source / "nested").mkdir(parents=True)
    (source / "brief.txt").write_text("preserve this exact brief", encoding="utf-8")
    (source / "nested" / "rules.json").write_text(
        '{"offline": true, "authority": "human"}', encoding="utf-8"
    )
    arena.seal_draft_input(challenge_id, "brief", source)
    for participant in ("one", "two"):
        arena.register_participant(challenge_id, participant)
    arena.lock_challenge(challenge_id)
    for participant, content in (("one", "candidate one"), ("two", "candidate two")):
        submission_source = Path(root) / f"source-{challenge_id}-{participant}"
        submission_source.mkdir(parents=True)
        (submission_source / "result.txt").write_text(content, encoding="utf-8")
        arena.submit(
            challenge_id,
            participant,
            submission_source,
            manifest_for(arena, challenge_id, participant),
        )
    arena.close_submissions(challenge_id)
    arena.run_deterministic_checks(challenge_id)
    arena.open_review(challenge_id)
    submit_equal_reviews(arena, challenge_id)
    arena.close_voting(challenge_id)
    arena.synthesize(challenge_id)
    return arena


class V02ReliabilityTests(unittest.TestCase):
    def test_version_is_consistent(self) -> None:
        self.assertEqual(__version__, "0.6.0")

    def test_contract_schemas_are_bundled_and_loadable(self) -> None:
        names = schema_names()
        self.assertIn("challenge-packet.schema.json", names)
        self.assertIn("deterministic-receipt.schema.json", names)
        self.assertIn("input-receipt.schema.json", names)
        self.assertIn("candidate-diagnostics.schema.json", names)
        self.assertIn("candidate-diagnostics-blind.schema.json", names)
        self.assertIn("blind-seed-reveal.schema.json", names)
        self.assertIn("seat-task.schema.json", names)
        self.assertIn("checkpoint.schema.json", names)
        self.assertIn("legacy-event-migration.schema.json", names)
        self.assertIn("bundle-verification.schema.json", names)
        self.assertEqual(len(names), 30)
        for name in names:
            schema = load_schema(name)
            self.assertEqual(schema.get("$schema"), "https://json-schema.org/draft/2020-12/schema")
        with self.assertRaises(ValueError):
            load_schema("../challenge-packet.schema.json")

    def test_module_job_adapter_rejects_ambiguous_or_future_envelopes(self) -> None:
        valid = {
            "schema_version": "axm.module-job/0.1",
            "job_id": "job-001",
            "source_module": "asset_factory",
            "artifact_kind": "asset",
            "title": "Asset round",
            "goal": "Create one asset.",
            "constraints": ["local-first"],
            "inputs": [],
            "notes": [],
            "packet_overrides": {},
        }
        packet = packet_from_module_job(valid)
        self.assertEqual(packet["schema_version"], "axm.challenge-arena/0.5")
        self.assertEqual(packet["constraints"], ["local-first"])

        malformed = copy.deepcopy(valid)
        malformed["constraints"] = "local-first"
        with self.assertRaises(ValueError):
            packet_from_module_job(malformed)

        future = copy.deepcopy(valid)
        future["schema_version"] = "axm.module-job/9.9"
        with self.assertRaises(ValueError):
            packet_from_module_job(future)

    def test_atomic_write_retries_a_transiently_missing_temp_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / "state.json"
            real_replace = os.replace
            calls = 0

            def transient_replace(source: str, destination: str | os.PathLike[str]) -> None:
                nonlocal calls
                calls += 1
                if calls == 1:
                    Path(source).unlink()
                    raise FileNotFoundError(source)
                real_replace(source, destination)

            with mock.patch("axm_challenge_arena.utils.os.replace", side_effect=transient_replace):
                atomic_write_bytes(target, b"sealed payload")

            self.assertEqual(calls, 2)
            self.assertEqual(target.read_bytes(), b"sealed payload")
            self.assertFalse(list(Path(temp).glob(".axm-atomic-*.tmp")))

    def test_unsafe_challenge_id_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("safe-id", "Safe", "Safe")
            packet["challenge_id"] = "../escape"
            with self.assertRaises(ValidationError):
                arena.create_challenge(packet)
            self.assertFalse((Path(temp).parent / "escape").exists())

    def test_lock_requires_minimum_submitters(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("minimum-lock", "Minimum", "Minimum")
            arena.create_challenge(packet)
            arena.register_participant("minimum-lock", "one")
            with self.assertRaises(ValidationError):
                arena.lock_challenge("minimum-lock")

    def test_late_registration_blocked_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("late-block", "Late block", "Late block")
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("late-block", participant)
            arena.lock_challenge("late-block")
            with self.assertRaises(ValidationError):
                arena.register_participant("late-block", "three")

    def test_explicit_late_registration_preserves_lock_integrity(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("late-allowed", "Late allowed", "Late allowed")
            packet["participant_policy"]["allow_late_registration"] = True
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("late-allowed", participant)
            locked = arena.lock_challenge("late-allowed")
            locked_hash = locked["locked_participant_roster_hash"]
            arena.register_participant("late-allowed", "three")
            state = arena.get("late-allowed")
            self.assertEqual(state["locked_participant_roster_hash"], locked_hash)
            self.assertNotEqual(state["participant_roster_hash"], locked_hash)
            report = arena.verify_integrity("late-allowed")
            self.assertTrue(report["valid"], report)

    def test_submission_must_acknowledge_locked_packet(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("ack-test", "Ack", "Ack")
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("ack-test", participant)
            arena.lock_challenge("ack-test")
            source = Path(temp) / "ack-source"
            source.mkdir()
            (source / "result.txt").write_text("x", encoding="utf-8")
            bad = manifest_for(arena, "ack-test", "one")
            bad["packet_hash"] = "0" * 64
            with self.assertRaises(ValidationError):
                arena.submit("ack-test", "one", source, bad)

    def test_required_deliverable_is_structurally_enforced(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("required-delivery", "Required", "Required")
            packet["deliverables"].append(
                {
                    "id": "secondary",
                    "description": "Required secondary output",
                    "required": True,
                    "accepted_media_types": ["text/plain"],
                }
            )
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("required-delivery", participant)
            arena.lock_challenge("required-delivery")
            source = Path(temp) / "required-source"
            source.mkdir()
            (source / "result.txt").write_text("x", encoding="utf-8")
            with self.assertRaises(ValidationError):
                arena.submit(
                    "required-delivery",
                    "one",
                    source,
                    manifest_for(arena, "required-delivery", "one"),
                )

    @unittest.skipIf(not hasattr(os, "symlink"), "symlinks unavailable")
    def test_symlink_artifact_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("symlink-test", "Symlink", "Symlink")
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("symlink-test", participant)
            arena.lock_challenge("symlink-test")
            source = Path(temp) / "symlink-source"
            source.mkdir()
            outside = Path(temp) / "outside.txt"
            outside.write_text("outside", encoding="utf-8")
            try:
                (source / "result.txt").symlink_to(outside)
            except OSError as exc:
                self.skipTest(f"symlink creation denied: {exc}")
            with self.assertRaises(ValidationError):
                arena.submit(
                    "symlink-test",
                    "one",
                    source,
                    manifest_for(arena, "symlink-test", "one"),
                )

    def test_exact_tie_withholds_provisional_winner(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = build_to_review(temp, "tie-test", contents={"one": "same", "two": "same"})
            submit_equal_reviews(arena, "tie-test")
            arena.close_voting("tie-test")
            result = arena.synthesize("tie-test")["result"]
            self.assertEqual(result["recommendation_status"], "EXACT_TIE")
            self.assertIsNone(result["provisional_winner"])
            self.assertEqual(len(result["exact_tie_labels"]), 2)
            self.assertTrue(arena.verify_integrity("tie-test")["valid"])

    def test_all_ineligible_candidates_withhold_winner(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            packet = generic_packet("ineligible-test", "Ineligible", "Ineligible")
            packet["deterministic_checks"].append(
                {
                    "id": "impossible_text",
                    "kind": "text_contains",
                    "criterion_id": "contract_compliance",
                    "weight": 10,
                    "required": True,
                    "config": {"deliverable_id": "primary", "needles": ["never-present"], "mode": "all"},
                }
            )
            arena = build_to_review(temp, "ineligible-test", packet=packet)
            submit_equal_reviews(arena, "ineligible-test")
            arena.close_voting("ineligible-test")
            result = arena.synthesize("ineligible-test")["result"]
            self.assertEqual(result["recommendation_status"], "ALL_CANDIDATES_INELIGIBLE")
            self.assertIsNone(result["provisional_winner"])

    def test_no_automatic_scoring_evidence_withholds_winner(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            packet = generic_packet("human-only", "Human only", "Human only")
            packet["rubric"] = [
                {
                    "id": "human_judgment",
                    "label": "Human judgment",
                    "weight": 100,
                    "source": "human",
                    "description": "Reserved for explicit human judgment.",
                    "score_min": 0,
                    "score_max": 100,
                }
            ]
            packet["deterministic_checks"] = []
            packet["participant_policy"]["minimum_automatic_weight_coverage_ratio"] = 0
            arena = build_to_review(temp, "human-only", packet=packet)
            submit_equal_reviews(arena, "human-only")
            arena.close_voting("human-only")
            result = arena.synthesize("human-only")["result"]
            self.assertEqual(result["recommendation_status"], "INSUFFICIENT_EVIDENCE")
            self.assertIsNone(result["provisional_winner"])
            self.assertTrue(any(gap["code"] == "NO_AUTOMATIC_SCORING_EVIDENCE" for gap in result["evidence_gaps"]))

    def test_portable_review_bundle_copies_candidates(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = build_to_review(temp, "portable-review")
            bridge = FileBridge(arena, Path(temp) / "bridge")
            destinations = bridge.export_review_packets("portable-review")
            self.assertEqual(len(destinations), 2)
            for destination in destinations:
                packet = json.loads((destination / "review-packet.json").read_text(encoding="utf-8"))
                self.assertTrue((destination / "BUNDLE-MANIFEST.json").is_file())
                for candidate in packet["candidates"]:
                    root = candidate["artifact_root"]
                    self.assertFalse(Path(root).is_absolute())
                    self.assertEqual(candidate["artifact_root_scope"], "relative_to_challenge_directory")
                    self.assertTrue((destination / root / "result.txt").is_file())

    def test_bridge_rejects_unsafe_direct_import_identifiers(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("bridge-paths", "Bridge paths", "Keep bridge paths contained.")
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("bridge-paths", participant)
            arena.lock_challenge("bridge-paths")
            bridge = FileBridge(arena, Path(temp) / "bridge")
            with self.assertRaises(ValidationError):
                bridge.import_build_submission("bridge-paths", "../escape")
            with self.assertRaises(ValidationError):
                bridge.import_review("../escape", "one")
            self.assertFalse((Path(temp) / "escape").exists())

    @unittest.skipIf(not hasattr(os, "symlink"), "symlinks unavailable")
    def test_portable_review_export_refuses_tampered_symlink_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = build_to_review(temp, "review-symlink-tamper")
            state = arena.get("review-symlink-tamper")
            submission_id = state["participant_active_submission"]["one"]
            stored = (
                arena.store.challenge_dir("review-symlink-tamper")
                / state["submissions"][submission_id]["relative_directory"]
                / "artifacts"
                / "result.txt"
            )
            outside = Path(temp) / "outside-review.txt"
            outside.write_text("outside", encoding="utf-8")
            stored.unlink()
            try:
                stored.symlink_to(outside)
            except (OSError, NotImplementedError):
                self.skipTest("symlink creation is unavailable")
            with self.assertRaises(IntegrityError):
                FileBridge(arena, Path(temp) / "bridge").export_review_packets(
                    "review-symlink-tamper"
                )

    def test_portable_result_bundle_copies_selected_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            run_demo(temp)
            arena = ChallengeArena(temp)
            bridge = FileBridge(arena, Path(temp) / "bridge")
            destination = bridge.export_result("arena-demo-001")
            envelope = json.loads((destination / "integration-return.json").read_text(encoding="utf-8"))
            self.assertTrue(envelope["selected_candidates"])
            for candidate in envelope["selected_candidates"]:
                root = candidate["artifact_root"]
                self.assertFalse(Path(root).is_absolute())
                self.assertEqual(candidate["artifact_root_scope"], "relative_to_result_bundle")
                self.assertTrue((destination / root).is_dir())

    def test_tampered_submission_is_blocked_before_deterministic_use(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet(
                "preflight-tamper", "Preflight tamper", "Never execute changed evidence."
            )
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("preflight-tamper", participant)
            arena.lock_challenge("preflight-tamper")
            for participant in ("one", "two"):
                source = Path(temp) / f"preflight-{participant}"
                source.mkdir()
                (source / "result.txt").write_text(participant, encoding="utf-8")
                arena.submit(
                    "preflight-tamper",
                    participant,
                    source,
                    manifest_for(arena, "preflight-tamper", participant),
                )
            arena.close_submissions("preflight-tamper")
            state = arena.get("preflight-tamper")
            submission_id = state["participant_active_submission"]["one"]
            artifacts_root = (
                arena.store.challenge_dir("preflight-tamper")
                / state["submissions"][submission_id]["relative_directory"]
                / "artifacts"
            )
            (artifacts_root / "undeclared.py").write_text(
                "raise SystemExit('must never run')", encoding="utf-8"
            )
            with self.assertRaises(IntegrityError):
                arena.run_deterministic_checks("preflight-tamper")
            report = arena.verify_integrity("preflight-tamper")
            self.assertFalse(report["valid"])
            self.assertIn("undeclared stored artifact", "\n".join(report["errors"]))
            self.assertEqual(arena.get("preflight-tamper")["state"], "SUBMISSIONS_CLOSED")

    def test_signed_external_receipt_is_bound_and_scored(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            packet = generic_packet("receipt-test", "Receipt", "Receipt")
            packet["deterministic_checks"].append(
                {
                    "id": "vm_tests",
                    "kind": "external_receipt",
                    "criterion_id": "contract_compliance",
                    "weight": 5,
                    "required": True,
                    "config": {"runner_id": "vm-runner", "result_id": "suite"},
                }
            )
            arena = ChallengeArena(temp, trusted_runner_keys={"vm-key": "secret"})
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("receipt-test", participant)
            arena.lock_challenge("receipt-test")
            submissions = {}
            for participant in ("one", "two"):
                source = Path(temp) / f"receipt-{participant}"
                source.mkdir()
                (source / "result.txt").write_text(participant, encoding="utf-8")
                submissions[participant] = arena.submit(
                    "receipt-test", participant, source, manifest_for(arena, "receipt-test", participant)
                )
            for submission in submissions.values():
                receipt = build_receipt(
                    challenge_id="receipt-test",
                    submission_id=submission["submission_id"],
                    packet_hash=arena.get("receipt-test")["packet_hash"],
                    rubric_hash=arena.get("receipt-test")["rubric_hash"],
                    submission_content_hash=submission["content_hash"],
                    artifact_set_hash=submission["artifact_set_hash"],
                    runner_id="vm-runner",
                    results=[{"result_id": "suite", "status": "PASS", "score": 97, "summary": "VM suite passed", "evidence": {"tests": 12}}],
                    key_id="vm-key",
                    key="secret",
                )
                arena.attach_external_receipt("receipt-test", submission["submission_id"], receipt)
            public = arena.public_view("receipt-test")
            self.assertEqual(public["external_receipts"]["sealed_receipt_count"], 2)
            self.assertNotIn("vm-key", json.dumps(public))
            arena.close_submissions("receipt-test")
            results = arena.run_deterministic_checks("receipt-test")
            for submission_result in results.values():
                vm_check = next(item for item in submission_result["checks"] if item["check_id"] == "vm_tests")
                self.assertEqual(vm_check["status"], "PASS")
                self.assertEqual(vm_check["score"], 97)
            self.assertTrue(arena.verify_integrity("receipt-test")["valid"])

    def test_external_receipt_wrong_binding_or_signature_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            packet = generic_packet("receipt-reject", "Receipt reject", "Receipt reject")
            arena = ChallengeArena(temp, trusted_runner_keys={"vm-key": "secret"})
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("receipt-reject", participant)
            arena.lock_challenge("receipt-reject")
            source = Path(temp) / "receipt-reject-source"
            source.mkdir()
            (source / "result.txt").write_text("one", encoding="utf-8")
            submission = arena.submit(
                "receipt-reject", "one", source, manifest_for(arena, "receipt-reject", "one")
            )
            state = arena.get("receipt-reject")
            wrong_binding = build_receipt(
                challenge_id="receipt-reject",
                submission_id=submission["submission_id"],
                packet_hash="f" * 64,
                rubric_hash=state["rubric_hash"],
                submission_content_hash=submission["content_hash"],
                artifact_set_hash=submission["artifact_set_hash"],
                runner_id="vm-runner",
                results=[{"result_id": "suite", "status": "PASS"}],
                key_id="vm-key",
                key="secret",
            )
            with self.assertRaises(IntegrityError):
                arena.attach_external_receipt("receipt-reject", submission["submission_id"], wrong_binding)
            wrong_signature = build_receipt(
                challenge_id="receipt-reject",
                submission_id=submission["submission_id"],
                packet_hash=state["packet_hash"],
                rubric_hash=state["rubric_hash"],
                submission_content_hash=submission["content_hash"],
                artifact_set_hash=submission["artifact_set_hash"],
                runner_id="vm-runner",
                results=[{"result_id": "suite", "status": "PASS"}],
                key_id="vm-key",
                key="wrong-secret",
            )
            with self.assertRaises(IntegrityError):
                arena.attach_external_receipt("receipt-reject", submission["submission_id"], wrong_signature)

    def test_zip_high_ratio_is_rejected_before_crc_decompression(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            submission = Path(temp) / "submission"
            artifacts = submission / "artifacts"
            artifacts.mkdir(parents=True)
            archive_path = artifacts / "payload.zip"
            with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.writestr("zeros.bin", b"0" * 1_000_000)
            manifest = {
                "artifacts": [
                    {
                        "path": "payload.zip",
                        "deliverable_id": "primary",
                        "role": "primary",
                        "media_type": "application/zip",
                    }
                ]
            }
            check = {
                "id": "zip_safe",
                "kind": "zip_integrity",
                "criterion_id": "contract_compliance",
                "weight": 1,
                "required": True,
                "config": {"path": "payload.zip", "max_compression_ratio": 5},
            }
            result = build_default_registry().run(check, submission, manifest, allow_execution=False)
            self.assertEqual(result["status"], "FAIL")
            details = result["evidence"]["archives"][0]
            self.assertFalse(details["crc_test_run"])
            self.assertTrue(details["high_compression_ratio_members"])

    def test_interrupted_lock_recovers_with_its_exact_locked_packet_sidecar(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("lock-recovery", "Lock recovery", "Recover one interrupted lock.")
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("lock-recovery", participant)
            original = arena.store._write_event_file

            def fail_once(*args: object, **kwargs: object) -> None:
                raise OSError("simulated power loss after lock journal")

            arena.store._write_event_file = fail_once  # type: ignore[method-assign]
            with self.assertRaises(OSError):
                arena.lock_challenge("lock-recovery")
            arena.store._write_event_file = original  # type: ignore[method-assign]
            locked_path = arena.store.challenge_dir("lock-recovery") / "packet.locked.json"
            self.assertTrue(locked_path.is_file())
            self.assertTrue(arena.store.pending_path("lock-recovery").is_file())

            recovered = ChallengeArena(temp)
            state = recovered.get("lock-recovery")
            self.assertEqual(state["state"], "BUILDING")
            self.assertFalse(recovered.store.pending_path("lock-recovery").exists())
            self.assertTrue(recovered.verify_integrity("lock-recovery")["valid"])

    def test_pending_commit_is_recovered_without_inventing_new_state(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("recovery-test", "Recovery", "Recovery")
            arena.create_challenge(packet)
            state = arena.get("recovery-test")
            state["recovery_marker"] = "journaled-value"
            event = arena.store._build_event(
                "recovery-test", state, action="RECOVERY_TEST", actor="test", payload={"marker": True}
            )
            target = copy.deepcopy(state)
            target["event_sequence"] = event["sequence"]
            target["event_head"] = event["event_hash"]
            target["updated_at"] = event["timestamp"]
            transaction = {
                "schema_version": "axm.challenge-arena-pending-commit/0.2",
                "challenge_id": "recovery-test",
                "event": event,
                "state": target,
                "state_hash": sha256_json(target),
                "created_at": event["timestamp"],
            }
            atomic_write_json(arena.store.pending_path("recovery-test"), transaction)
            recovered_arena = ChallengeArena(temp)
            recovered = recovered_arena.get("recovery-test")
            self.assertEqual(recovered["recovery_marker"], "journaled-value")
            self.assertFalse(recovered_arena.store.pending_path("recovery-test").exists())
            self.assertTrue(recovered_arena.verify_integrity("recovery-test")["valid"])

    def test_evidence_bundle_is_reproducible_for_same_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            run_demo(temp)
            arena = ChallengeArena(temp)
            first = arena.export_evidence_bundle("arena-demo-001", Path(temp) / "first.zip")
            second = arena.export_evidence_bundle("arena-demo-001", Path(temp) / "second.zip")
            self.assertEqual(first["sha256"], second["sha256"])
            self.assertEqual(sha256_file(Path(first["path"])), sha256_file(Path(second["path"])))
            with zipfile.ZipFile(first["path"], "r") as archive:
                self.assertIsNone(archive.testzip())
                self.assertIn("BUNDLE-MANIFEST.json", archive.namelist())
                self.assertIn("INTEGRITY-REPORT.json", archive.namelist())

    def test_followup_preserves_parent_and_lineage(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            run_demo(temp)
            arena = ChallengeArena(temp)
            before = arena.get("arena-demo-001")
            before_result_hash = sha256_json(before["result"])
            returned = arena.spawn_followup("arena-demo-001", "arena-demo-002", mode="BEAT_WINNER")
            child = returned["child"]
            self.assertEqual(child["state"], "DRAFT")
            self.assertEqual(child["lineage"]["parent_challenge_id"], "arena-demo-001")
            parent = arena.get("arena-demo-001")
            self.assertEqual(sha256_json(parent["result"]), before_result_hash)
            lineage = arena.lineage_view("arena-demo-002")
            self.assertEqual(lineage["ancestry_nearest_first"][0]["challenge_id"], "arena-demo-001")
            self.assertTrue(arena.verify_integrity("arena-demo-001")["valid"])

    def test_draft_input_sealing_updates_packet_and_exports_portably(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("sealed-input", "Sealed input", "Use an exact local source brief.")
            packet["inputs"] = [
                {
                    "id": "brief",
                    "kind": "directory",
                    "required": True,
                    "path": "/must/not/leak/into/the/locked/packet",
                }
            ]
            created = arena.create_challenge(packet)
            original_packet_hash = created["packet_hash"]

            source = Path(temp) / "source-brief"
            (source / "nested").mkdir(parents=True)
            (source / "brief.txt").write_text("build the smallest safe local tool", encoding="utf-8")
            (source / "nested" / "constraints.json").write_text(
                '{"offline": true}', encoding="utf-8"
            )

            sealed = arena.seal_draft_input("sealed-input", "brief", source)
            self.assertNotEqual(sealed["packet_hash"], original_packet_hash)
            state = arena.get("sealed-input")
            input_item = state["packet"]["inputs"][0]
            self.assertNotIn("path", input_item)
            self.assertNotIn(str(source), json.dumps(state["packet"]))
            self.assertTrue(input_item["portable"])
            self.assertEqual(len(input_item["artifact_files"]), 2)
            receipt_path = (
                arena.store.challenge_dir("sealed-input")
                / "inputs"
                / "brief"
                / "input-receipt.json"
            )
            self.assertTrue(receipt_path.is_file())
            self.assertTrue(arena.verify_integrity("sealed-input")["valid"])

            for participant in ("one", "two"):
                arena.register_participant("sealed-input", participant)
            arena.lock_challenge("sealed-input")
            folders = FileBridge(arena, Path(temp) / "bridge").export_build_packets(
                "sealed-input"
            )
            self.assertEqual(len(folders), 2)
            for folder in folders:
                exported = json.loads(
                    (folder / "challenge-packet.json").read_text(encoding="utf-8")
                )
                self.assertEqual(
                    exported["packet_hash"], arena.get("sealed-input")["packet_hash"]
                )
                self.assertEqual(len(exported["portable_inputs"]), 1)
                portable = exported["portable_inputs"][0]
                for evidence in portable["artifact_files"]:
                    copied = folder / portable["bundle_root"] / evidence["path"]
                    self.assertTrue(copied.is_file())
                    self.assertEqual(sha256_file(copied), evidence["sha256"])
                submission_template = json.loads(
                    (folder / "submission.template.json").read_text(encoding="utf-8")
                )
                self.assertEqual(
                    submission_template["schema_version"],
                    "axm.challenge-submission/0.2",
                )

    def test_sealed_draft_input_tamper_and_undeclared_files_are_detected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("sealed-tamper", "Sealed tamper", "Detect source drift.")
            packet["inputs"] = [{"id": "brief", "kind": "file", "required": True}]
            arena.create_challenge(packet)
            source = Path(temp) / "brief.txt"
            source.write_text("original", encoding="utf-8")
            arena.seal_draft_input("sealed-tamper", "brief", source)
            stored_root = (
                arena.store.challenge_dir("sealed-tamper")
                / "inputs"
                / "brief"
                / "artifacts"
            )
            (stored_root / "brief.txt").write_text("tampered", encoding="utf-8")
            (stored_root / "undeclared.txt").write_text("hidden extra", encoding="utf-8")
            report = arena.verify_integrity("sealed-tamper")
            self.assertFalse(report["valid"])
            joined = "\n".join(report["errors"])
            self.assertIn("hash mismatch", joined)
            self.assertIn("undeclared artifact", joined)

    def test_draft_input_cannot_be_resealed_or_sealed_after_lock(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("seal-boundary", "Seal boundary", "Preserve input revisions.")
            packet["inputs"] = [
                {"id": "brief", "kind": "file", "required": True},
                {"id": "later", "kind": "file", "required": False},
            ]
            arena.create_challenge(packet)
            source = Path(temp) / "source.txt"
            source.write_text("v1", encoding="utf-8")
            arena.seal_draft_input("seal-boundary", "brief", source)
            with self.assertRaises(ValidationError):
                arena.seal_draft_input("seal-boundary", "brief", source)
            for participant in ("one", "two"):
                arena.register_participant("seal-boundary", participant)
            arena.lock_challenge("seal-boundary")
            with self.assertRaises(StateError):
                arena.seal_draft_input("seal-boundary", "later", source)

    def test_followup_reseals_inherited_challenge_inputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = build_synthesized_with_sealed_input(temp, "sealed-parent")
            parent = arena.get("sealed-parent")
            parent_input = next(
                item for item in parent["packet"]["inputs"] if item["id"] == "brief"
            )
            selected = sorted(parent["blind_map"])[0]

            returned = arena.spawn_followup(
                "sealed-parent",
                "sealed-child",
                mode="RERUN",
                selected_blind_labels=[selected],
            )
            child = returned["child"]
            child_input = next(
                item for item in child["packet"]["inputs"] if item["id"] == "brief"
            )
            self.assertTrue(arena.verify_integrity("sealed-child")["valid"])
            self.assertTrue(child_input["seal_receipt_hash"])
            self.assertEqual(
                child_input["artifact_set_hash"], parent_input["artifact_set_hash"]
            )
            self.assertNotEqual(
                child_input["seal_receipt_hash"], parent_input["seal_receipt_hash"]
            )

            parent_root = (
                arena.store.challenge_dir("sealed-parent")
                / parent_input["artifact_root"]
            )
            child_root = (
                arena.store.challenge_dir("sealed-child")
                / child_input["artifact_root"]
            )
            for evidence in parent_input["artifact_files"]:
                parent_file = parent_root / evidence["path"]
                child_file = child_root / evidence["path"]
                self.assertEqual(parent_file.read_bytes(), child_file.read_bytes())
                self.assertEqual(sha256_file(child_file), evidence["sha256"])

            child_receipt = json.loads(
                (child_root.parent / "input-receipt.json").read_text(encoding="utf-8")
            )
            self.assertEqual(child_receipt["challenge_id"], "sealed-child")
            self.assertEqual(child_receipt["input_id"], "brief")
            packet_text = json.dumps(child["packet"], sort_keys=True)
            self.assertNotIn(str(arena.store.challenge_dir("sealed-parent")), packet_text)

    def test_followup_refuses_tampered_inherited_sealed_input(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = build_synthesized_with_sealed_input(temp, "tampered-parent")
            parent = arena.get("tampered-parent")
            parent_input = next(
                item for item in parent["packet"]["inputs"] if item["id"] == "brief"
            )
            stored_file = (
                arena.store.challenge_dir("tampered-parent")
                / parent_input["artifact_root"]
                / parent_input["artifact_files"][0]["path"]
            )
            stored_file.write_bytes(stored_file.read_bytes() + b"tamper")
            selected = sorted(parent["blind_map"])[0]

            with self.assertRaises(IntegrityError):
                arena.spawn_followup(
                    "tampered-parent",
                    "tampered-child",
                    mode="RERUN",
                    selected_blind_labels=[selected],
                )
            self.assertFalse(arena.store.exists("tampered-child"))

    def test_followup_aborts_if_inherited_input_changes_during_reseal(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = build_synthesized_with_sealed_input(temp, "race-parent")
            parent = arena.get("race-parent")
            parent_input = next(
                item for item in parent["packet"]["inputs"] if item["id"] == "brief"
            )
            stored_file = (
                arena.store.challenge_dir("race-parent")
                / parent_input["artifact_root"]
                / parent_input["artifact_files"][0]["path"]
            )
            selected = sorted(parent["blind_map"])[0]
            real_seal = arena.seal_draft_input
            changed = False

            def change_then_seal(*args, **kwargs):
                nonlocal changed
                if not changed:
                    stored_file.write_bytes(stored_file.read_bytes() + b"changed-after-check")
                    changed = True
                return real_seal(*args, **kwargs)

            with mock.patch.object(arena, "seal_draft_input", side_effect=change_then_seal):
                with self.assertRaises(IntegrityError):
                    arena.spawn_followup(
                        "race-parent",
                        "race-child",
                        mode="RERUN",
                        selected_blind_labels=[selected],
                    )

            self.assertTrue(arena.store.exists("race-child"))
            self.assertEqual(arena.get("race-child")["state"], "ABORTED")
            self.assertFalse(
                any(
                    item.get("challenge_id") == "race-child"
                    for item in arena.get("race-parent").get("followups", [])
                )
            )

    def test_followup_build_packets_include_hash_bound_portable_inputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            run_demo(temp)
            arena = ChallengeArena(temp)
            arena.spawn_followup(
                "arena-demo-001",
                "portable-followup",
                mode="BEAT_WINNER",
            )
            arena.lock_challenge("portable-followup")
            bridge_root = Path(temp) / "bridge"
            folders = FileBridge(arena, bridge_root).export_build_packets("portable-followup")
            self.assertGreaterEqual(len(folders), 2)
            for folder in folders:
                packet = json.loads((folder / "challenge-packet.json").read_text(encoding="utf-8"))
                self.assertEqual(packet["packet_hash"], arena.get("portable-followup")["packet_hash"])
                self.assertTrue(packet["portable_inputs"])
                self.assertFalse(packet["input_warnings"])
                portable = packet["portable_inputs"][0]
                copied = folder / portable["bundle_root"] / portable["artifact_files"][0]["path"]
                self.assertTrue(copied.is_file())
                self.assertEqual(copied.stat().st_size, portable["artifact_files"][0]["bytes"])
                self.assertEqual(sha256_file(copied), portable["artifact_files"][0]["sha256"])
                self.assertFalse(Path(portable["bundle_root"]).is_absolute())

    def test_observer_uses_security_headers_and_current_version(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            server = build_server(temp, host="127.0.0.1", port=0)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                host, port = server.server_address
                with urllib.request.urlopen(f"http://{host}:{port}/api/health", timeout=5) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                    self.assertEqual(payload["version"], __version__)
                    self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
                    self.assertEqual(response.headers["X-Frame-Options"], "DENY")
                    self.assertIn("frame-ancestors 'none'", response.headers["Content-Security-Policy"])
                    self.assertEqual(response.headers["Referrer-Policy"], "no-referrer")
                    self.assertEqual(response.headers["Cross-Origin-Resource-Policy"], "same-origin")
                    self.assertEqual(response.headers["Cross-Origin-Opener-Policy"], "same-origin")
                    self.assertEqual(response.headers["X-Permitted-Cross-Domain-Policies"], "none")
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)

    def test_progress_reports_missing_and_completed_work(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            packet = generic_packet("progress-test", "Progress", "Progress")
            arena.create_challenge(packet)
            for participant in ("one", "two"):
                arena.register_participant("progress-test", participant)
            arena.lock_challenge("progress-test")
            source = Path(temp) / "progress-one"
            source.mkdir()
            (source / "result.txt").write_text("one", encoding="utf-8")
            arena.submit("progress-test", "one", source, manifest_for(arena, "progress-test", "one"))
            progress = arena.progress("progress-test")
            self.assertEqual(progress["submitters"]["completed"], ["one"])
            self.assertEqual(progress["submitters"]["missing"], ["two"])
            self.assertFalse(progress["submitters"]["all_completed"])

    def test_review_revision_preserves_original_file_immutably(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = build_to_review(temp, "review-revision")
            packet = arena.review_packet("review-revision", "one")

            def payload(score: float, reason: str) -> dict:
                scores = {
                    criterion["id"]: score for criterion in packet["peer_criteria"]
                }
                return {
                    "schema_version": "axm.challenge-review/0.4",
                    "rubric_hash": packet["rubric_hash"],
                    "assignment_hash": packet["assignment_hash"],
                    "review_packet_hash": packet["review_packet_hash"],
                    "evaluations": {
                        label: {
                            "scores": scores,
                            "evidence_refs": {
                                criterion_id: [{
                                    "kind": "artifact",
                                    "path": "result.txt",
                                    "note": reason,
                                }]
                                for criterion_id in scores
                            },
                            "strengths": [reason],
                            "weaknesses": [],
                            "risks": [],
                            "merge_worthy": [],
                        }
                        for label in packet["candidate_labels"]
                    },
                    "ranking_tiers": [[label] for label in packet["candidate_labels"]],
                    "ranking": list(packet["candidate_labels"]),
                    "overall_reason": reason,
                }

            first = arena.submit_review(
                "review-revision", "one", payload(60.0, "first evidence")
            )
            first_path = (
                arena.store.challenge_dir("review-revision")
                / "reviews"
                / f"{first['review_id']}.json"
            )
            original_bytes = first_path.read_bytes()
            original_hash = sha256_file(first_path)

            second = arena.submit_review(
                "review-revision",
                "one",
                payload(75.0, "revised evidence"),
                replace=True,
                expected_previous_review_id=first["review_id"],
            )
            state = arena.get("review-revision")
            self.assertEqual(first_path.read_bytes(), original_bytes)
            self.assertEqual(sha256_file(first_path), original_hash)
            self.assertEqual(
                state["reviews"][first["review_id"]]["status"], "SUPERSEDED"
            )
            self.assertEqual(
                state["reviews"][first["review_id"]]["superseded_by"],
                second["review_id"],
            )
            self.assertEqual(second["supersedes"], first["review_id"])
            self.assertEqual(
                state["participant_active_review"]["one"], second["review_id"]
            )
            report = arena.verify_integrity("review-revision")
            self.assertTrue(report["valid"], report)

    def test_interrupted_review_commit_recovers_its_immutable_sidecar(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = build_to_review(temp, "review-recovery")
            packet = arena.review_packet("review-recovery", "one")
            scores = {
                criterion["id"]: 68.0 for criterion in packet["peer_criteria"]
            }
            review = {
                "schema_version": "axm.challenge-review/0.4",
                "rubric_hash": packet["rubric_hash"],
                "assignment_hash": packet["assignment_hash"],
                "review_packet_hash": packet["review_packet_hash"],
                "evaluations": {
                    label: {
                        "scores": scores,
                        "evidence_refs": {
                            criterion_id: [{
                                "kind": "artifact",
                                "path": "result.txt",
                                "note": "recoverable review evidence",
                            }]
                            for criterion_id in scores
                        },
                        "strengths": ["recoverable"],
                        "weaknesses": [],
                        "risks": [],
                        "merge_worthy": [],
                    }
                    for label in packet["candidate_labels"]
                },
                "ranking_tiers": [[label] for label in packet["candidate_labels"]],
                "ranking": list(packet["candidate_labels"]),
                "overall_reason": "recover exact review bytes",
            }

            with mock.patch.object(
                arena.store,
                "_write_event_file",
                side_effect=RuntimeError("simulated power loss"),
            ):
                with self.assertRaises(RuntimeError):
                    arena.submit_review("review-recovery", "one", review)

            pending_path = arena.store.pending_path("review-recovery")
            self.assertTrue(pending_path.is_file())
            pending = json.loads(pending_path.read_text(encoding="utf-8"))
            review_id = pending["event"]["payload"]["review_id"]
            expected_hash = pending["event"]["payload"]["review_file_sha256"]
            review_path = (
                arena.store.challenge_dir("review-recovery")
                / "reviews"
                / f"{review_id}.json"
            )
            self.assertTrue(review_path.is_file())
            self.assertEqual(sha256_file(review_path), expected_hash)

            recovered = ChallengeArena(temp)
            state = recovered.get("review-recovery")
            self.assertFalse(recovered.store.pending_path("review-recovery").exists())
            self.assertEqual(state["participant_active_review"]["one"], review_id)
            report = recovered.verify_integrity("review-recovery")
            self.assertTrue(report["valid"], report)

    def test_interrupted_synthesis_recovers_all_report_sidecars(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = build_to_review(temp, "report-recovery")
            submit_equal_reviews(arena, "report-recovery", 64.0)
            arena.close_voting("report-recovery")

            with mock.patch.object(
                arena.store,
                "_write_event_file",
                side_effect=RuntimeError("simulated power loss"),
            ):
                with self.assertRaises(RuntimeError):
                    arena.synthesize("report-recovery")

            pending_path = arena.store.pending_path("report-recovery")
            pending = json.loads(pending_path.read_text(encoding="utf-8"))
            report_hashes = pending["event"]["payload"]["report_file_sha256"]
            for relative_path, expected_hash in report_hashes.items():
                path = arena.store.challenge_dir("report-recovery") / relative_path
                self.assertTrue(path.is_file())
                self.assertEqual(sha256_file(path), expected_hash)

            recovered = ChallengeArena(temp)
            self.assertEqual(recovered.get("report-recovery")["state"], "SYNTHESIZED")
            self.assertFalse(recovered.store.pending_path("report-recovery").exists())
            report = recovered.verify_integrity("report-recovery")
            self.assertTrue(report["valid"], report)

    def test_pending_sidecar_substitution_is_rejected_by_event_binding(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = build_to_review(temp, "sidecar-binding")
            submit_equal_reviews(arena, "sidecar-binding", 61.0)
            arena.close_voting("sidecar-binding")
            with mock.patch.object(
                arena.store,
                "_write_event_file",
                side_effect=RuntimeError("simulated power loss"),
            ):
                with self.assertRaises(RuntimeError):
                    arena.synthesize("sidecar-binding")

            pending_path = arena.store.pending_path("sidecar-binding")
            pending = json.loads(pending_path.read_text(encoding="utf-8"))
            pending["sidecars"][0]["content"] += "\n"
            pending["sidecars"][0]["sha256"] = sha256_bytes(
                pending["sidecars"][0]["content"].encode("utf-8")
            )
            atomic_write_json(pending_path, pending)
            with self.assertRaises(IntegrityError):
                arena.store.recover_pending("sidecar-binding")

    def test_interrupted_finalization_recovers_human_decision_reports(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            run_demo(temp)
            arena = ChallengeArena(temp)
            with mock.patch.object(
                arena.store,
                "_write_event_file",
                side_effect=RuntimeError("simulated power loss"),
            ):
                with self.assertRaises(RuntimeError):
                    arena.finalize(
                        "arena-demo-001",
                        {
                            "action": "HOLD",
                            "notes": "preserve all candidates pending human inspection",
                        },
                    )

            pending = json.loads(
                arena.store.pending_path("arena-demo-001").read_text(encoding="utf-8")
            )
            sidecar_evidence = pending["event"]["payload"]["transaction_sidecars"]
            self.assertEqual(len(sidecar_evidence), 3)
            for item in sidecar_evidence:
                path = arena.store.challenge_dir("arena-demo-001") / item["relative_path"]
                self.assertTrue(path.is_file())
                self.assertEqual(sha256_file(path), item["sha256"])

            recovered = ChallengeArena(temp)
            state = recovered.get("arena-demo-001")
            self.assertEqual(state["state"], "FINALIZED")
            self.assertEqual(state["final_decision"]["action"], "HOLD")
            self.assertFalse(recovered.store.pending_path("arena-demo-001").exists())
            report = recovered.verify_integrity("arena-demo-001")
            self.assertTrue(report["valid"], report)


if __name__ == "__main__":
    unittest.main()
