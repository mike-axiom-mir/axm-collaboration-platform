from __future__ import annotations

import copy
import json
import os
import shutil
import tempfile
import unittest
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from axm_challenge_arena import ChallengeArena, build_receipt
from axm_challenge_arena.bridge import FileBridge
from axm_challenge_arena.contracts import normalize_packet
from axm_challenge_arena.demo import run_demo
from axm_challenge_arena.errors import IntegrityError, ValidationError
from axm_challenge_arena.presets import generic_packet
from axm_challenge_arena.validators import build_default_registry
from axm_challenge_arena.voting import aggregate_votes


def manifest_for(arena: ChallengeArena, cid: str, participant: str, path: str = "result.txt") -> dict:
    contract = arena.submission_contract(cid, participant)
    return {
        "challenge_id": cid,
        "packet_hash": contract["packet_hash"],
        "rubric_hash": contract["rubric_hash"],
        "participant_id": participant,
        "summary": "v0.2 test candidate",
        "artifacts": [
            {
                "path": path,
                "deliverable_id": "primary",
                "role": "primary",
                "media_type": "application/octet-stream",
                "provenance": {"origin": "unit test", "rights": "CC0-1.0"},
            }
        ],
    }


def locked_arena(root: str | Path, cid: str, participants: tuple[str, ...] = ("one", "two"), *, packet: dict | None = None, **arena_kwargs: object) -> ChallengeArena:
    arena = ChallengeArena(root, **arena_kwargs)
    arena.create_challenge(packet or generic_packet(cid, cid, "Exercise the v0.2 contract."))
    for participant in participants:
        arena.register_participant(cid, participant)
    arena.lock_challenge(cid)
    return arena


def submit_text(arena: ChallengeArena, root: str | Path, cid: str, participant: str, text: str) -> dict:
    source = Path(root) / f"source-{cid}-{participant}"
    source.mkdir(parents=True, exist_ok=True)
    (source / "result.txt").write_text(text, encoding="utf-8")
    return arena.submit(cid, participant, source, manifest_for(arena, cid, participant))


class ArenaV02Tests(unittest.TestCase):
    def test_stale_packet_acknowledgement_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = locked_arena(temp, "stale-ack")
            source = Path(temp) / "source"
            source.mkdir()
            (source / "result.txt").write_text("candidate", encoding="utf-8")
            manifest = manifest_for(arena, "stale-ack", "one")
            manifest["packet_hash"] = "0" * 64
            with self.assertRaises(ValidationError):
                arena.submit("stale-ack", "one", source, manifest)

    def test_write_ahead_commit_recovers_after_interrupted_event_write(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = ChallengeArena(temp)
            arena.create_challenge(generic_packet("recover-commit", "Recover", "Recover one interrupted mutation."))
            original = arena.store._write_event_file

            def fail_once(*args: object, **kwargs: object) -> None:
                raise OSError("simulated power loss after journal write")

            arena.store._write_event_file = fail_once  # type: ignore[method-assign]
            with self.assertRaises(OSError):
                arena.register_participant("recover-commit", "one")
            arena.store._write_event_file = original  # type: ignore[method-assign]
            self.assertTrue(arena.store.pending_path("recover-commit").is_file())

            recovered = ChallengeArena(temp)
            state = recovered.get("recover-commit")
            self.assertIn("one", state["participants"])
            self.assertFalse(recovered.store.pending_path("recover-commit").exists())
            self.assertTrue(recovered.verify_integrity("recover-commit")["valid"])

    def test_cross_instance_file_lock_preserves_concurrent_registrations(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            ChallengeArena(temp).create_challenge(
                generic_packet("concurrent", "Concurrent", "Serialize concurrent local processes.")
            )
            participants = [f"p{index}" for index in range(8)]

            def register(participant: str) -> None:
                ChallengeArena(temp).register_participant("concurrent", participant)

            with ThreadPoolExecutor(max_workers=8) as pool:
                list(pool.map(register, participants))
            state = ChallengeArena(temp).get("concurrent")
            self.assertEqual(set(state["participants"]), set(participants))
            self.assertTrue(ChallengeArena(temp).verify_integrity("concurrent")["valid"])

    def test_duplicate_candidate_diagnostics_are_evidence_not_penalty(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = locked_arena(temp, "duplicates")
            submit_text(arena, temp, "duplicates", "one", "same artifact bytes")
            submit_text(arena, temp, "duplicates", "two", "same artifact bytes")
            state = arena.close_submissions("duplicates")
            groups = state["candidate_diagnostics"]["exact_duplicate_groups"]
            self.assertEqual(len(groups), 1)
            self.assertEqual(groups[0]["candidate_count"], 2)
            self.assertFalse(state["candidate_diagnostics"]["policy"]["automatic_penalty"])

    def test_signed_external_receipt_is_bound_and_reusable_without_secret(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            packet = generic_packet("receipt", "Receipt", "Accept specialist deterministic evidence.")
            packet["deterministic_checks"].append(
                {
                    "id": "engine-smoke",
                    "kind": "external_receipt",
                    "criterion_id": "contract_compliance",
                    "weight": 2,
                    "required": False,
                    "config": {"result_id": "engine-smoke", "runner_id": "game-engine"},
                }
            )
            arena = locked_arena(
                temp,
                "receipt",
                packet=packet,
                trusted_runner_keys={"runner-key": "secret"},
            )
            first = submit_text(arena, temp, "receipt", "one", "candidate one")
            submit_text(arena, temp, "receipt", "two", "candidate two")
            state = arena.get("receipt")
            receipt = build_receipt(
                challenge_id="receipt",
                submission_id=first["submission_id"],
                packet_hash=state["packet_hash"],
                rubric_hash=state["rubric_hash"],
                submission_content_hash=first["content_hash"],
                artifact_set_hash=first["artifact_set_hash"],
                runner_id="game-engine",
                results=[
                    {
                        "result_id": "engine-smoke",
                        "status": "PASS",
                        "score": 96,
                        "summary": "Specialist engine opened and closed the package.",
                        "evidence": {"frames": 120},
                    }
                ],
                key_id="runner-key",
                key="secret",
            )
            attached = arena.attach_external_receipt("receipt", first["submission_id"], receipt)
            self.assertEqual(attached["status"], "ATTACHED")
            index = arena.get("receipt")["external_receipts"][first["submission_id"]][receipt["receipt_hash"]]
            self.assertNotIn("results", index)
            self.assertTrue(index["signature_valid_at_ingest"])

            arena.close_submissions("receipt")
            results = arena.run_deterministic_checks("receipt")
            check = next(item for item in results[first["submission_id"]]["checks"] if item["check_id"] == "engine-smoke")
            self.assertEqual(check["status"], "PASS")
            self.assertEqual(check["score"], 96.0)

            reopened_without_secret = ChallengeArena(temp)
            self.assertTrue(reopened_without_secret.verify_integrity("receipt")["valid"])

    def test_forged_external_receipt_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = locked_arena(temp, "forged", trusted_runner_keys={"key": "secret"})
            first = submit_text(arena, temp, "forged", "one", "one")
            submit_text(arena, temp, "forged", "two", "two")
            state = arena.get("forged")
            receipt = build_receipt(
                challenge_id="forged",
                submission_id=first["submission_id"],
                packet_hash=state["packet_hash"],
                rubric_hash=state["rubric_hash"],
                submission_content_hash=first["content_hash"],
                artifact_set_hash=first["artifact_set_hash"],
                runner_id="runner",
                results=[{"result_id": "smoke", "status": "PASS", "score": 100, "evidence": {}}],
                key_id="key",
                key="secret",
            )
            receipt["results"][0]["score"] = 0
            with self.assertRaises(IntegrityError):
                arena.attach_external_receipt("forged", first["submission_id"], receipt)

    def test_followup_round_preserves_parent_and_explicit_lineage(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            run_demo(temp)
            arena = ChallengeArena(temp)
            result = arena.spawn_followup(
                "arena-demo-001",
                "arena-demo-rematch",
                mode="BEAT_WINNER",
            )
            self.assertEqual(result["child"]["state"], "DRAFT")
            self.assertEqual(
                result["child"]["lineage"]["parent_challenge_id"],
                "arena-demo-001",
            )
            self.assertIsNone(result["child"]["final_decision"])
            self.assertEqual(arena.get("arena-demo-001")["state"], "SYNTHESIZED")
            lineage = arena.lineage_view("arena-demo-001")
            self.assertTrue(any(child["challenge_id"] == "arena-demo-rematch" for child in lineage["children"]))
            self.assertTrue(arena.verify_integrity("arena-demo-001")["valid"])
            self.assertTrue(arena.verify_integrity("arena-demo-rematch")["valid"])

    def test_evidence_bundle_is_byte_reproducible_for_same_snapshot(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            run_demo(temp)
            arena = ChallengeArena(temp)
            first = arena.export_evidence_bundle("arena-demo-001", Path(temp) / "first.zip")
            second = arena.export_evidence_bundle("arena-demo-001", Path(temp) / "second.zip")
            self.assertEqual(first["sha256"], second["sha256"])
            self.assertEqual((Path(temp) / "first.zip").read_bytes(), (Path(temp) / "second.zip").read_bytes())

    def test_bridge_sync_is_idempotent_and_stops_before_human_decision(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            workspace = Path(temp) / "workspace"
            bridge_root = Path(temp) / "bridge"
            arena = locked_arena(workspace, "bridge-sync")
            bridge = FileBridge(arena, bridge_root)
            outgoing_build = bridge.export_build_packets("bridge-sync")
            for folder in outgoing_build:
                participant = folder.name
                incoming = bridge_root / "incoming" / "bridge-sync" / "build" / participant
                (incoming / "artifacts").mkdir(parents=True)
                manifest = json.loads((folder / "submission.template.json").read_text(encoding="utf-8"))
                manifest["artifacts"][0]["path"] = "result.txt"
                (incoming / "artifacts" / "result.txt").write_text(f"result from {participant}", encoding="utf-8")
                (incoming / "submission.json").write_text(json.dumps(manifest), encoding="utf-8")

            first_sync = bridge.sync_challenge("bridge-sync", advance=True)
            self.assertEqual(first_sync["final_status"]["phase"], "REVIEW_OPEN")
            unchanged = bridge.import_build_submission("bridge-sync", "one")
            self.assertEqual(unchanged["bridge_import_status"], "UNCHANGED")

            review_root = bridge_root / "outgoing" / "bridge-sync" / "review"
            for folder in sorted(review_root.iterdir()):
                if not folder.is_dir():
                    continue
                incoming = bridge_root / "incoming" / "bridge-sync" / "review" / folder.name
                incoming.mkdir(parents=True)
                shutil.copy2(folder / "review.template.json", incoming / "review.json")

            second_sync = bridge.sync_challenge("bridge-sync", advance=True)
            self.assertEqual(second_sync["final_status"]["phase"], "SYNTHESIZED")
            self.assertIsNone(arena.get("bridge-sync")["final_decision"])
            event_count = arena.verify_integrity("bridge-sync")["event_chain"]["event_count"]
            third_sync = bridge.sync_challenge("bridge-sync", advance=True)
            self.assertEqual(third_sync["final_status"]["phase"], "SYNTHESIZED")
            self.assertEqual(arena.verify_integrity("bridge-sync")["event_chain"]["event_count"], event_count)

    def test_zip_validator_refuses_archive_bomb_metadata_before_crc(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            artifacts = root / "artifacts"
            artifacts.mkdir()
            archive_path = artifacts / "payload.zip"
            with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.writestr("huge.txt", "A" * 200_000)
            manifest = {"artifacts": [{"path": "payload.zip", "deliverable_id": "primary"}]}
            registry = build_default_registry()
            result = registry.run(
                {
                    "id": "zip",
                    "kind": "zip_integrity",
                    "criterion_id": None,
                    "required": True,
                    "config": {
                        "path": "payload.zip",
                        "max_total_uncompressed_bytes": 1_000,
                        "max_member_uncompressed_bytes": 1_000,
                    },
                },
                root,
                manifest,
            )
            self.assertEqual(result["status"], "FAIL")
            evidence = result["evidence"]["archives"][0]
            self.assertFalse(evidence["crc_test_run"])
            self.assertTrue(evidence["oversized_members"])

    def test_late_registration_is_rejected_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = locked_arena(temp, "sealed-roster")
            with self.assertRaises(ValidationError):
                arena.register_participant("sealed-roster", "late")

    def test_symlink_artifact_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = locked_arena(temp, "symlink")
            source = Path(temp) / "symlink-source"
            source.mkdir()
            target = source / "real.txt"
            target.write_text("real", encoding="utf-8")
            link = source / "result.txt"
            try:
                link.symlink_to(target)
            except (OSError, NotImplementedError):
                self.skipTest("symlink creation is unavailable")
            with self.assertRaises(ValidationError):
                arena.submit("symlink", "one", source, manifest_for(arena, "symlink", "one"))

    def test_median_peer_aggregation_resists_one_extreme_ballot(self) -> None:
        packet = normalize_packet(generic_packet("median", "Median", "Use robust peer aggregation."))
        peer_ids = [criterion["id"] for criterion in packet["rubric"] if criterion["source"] == "peer"]
        reviews = {}
        score_sets = [(90, 70), (90, 70), (0, 100)]
        for index, (a_score, b_score) in enumerate(score_sets):
            evaluations = {
                "Candidate-A": {
                    "scores": {criterion: a_score for criterion in peer_ids},
                    "evidence_refs": {
                        criterion: [{"kind": "observation", "note": "fixture evidence"}]
                        for criterion in peer_ids
                    },
                },
                "Candidate-B": {
                    "scores": {criterion: b_score for criterion in peer_ids},
                    "evidence_refs": {
                        criterion: [{"kind": "observation", "note": "fixture evidence"}]
                        for criterion in peer_ids
                    },
                },
            }
            reviews[f"review-{index}"] = {
                "status": "ACTIVE",
                "reviewer_id": f"r{index}",
                "evaluations": evaluations,
                "ranking": ["Candidate-A", "Candidate-B"] if a_score >= b_score else ["Candidate-B", "Candidate-A"],
                "overall_reason": "test ballot",
            }
        tests = {
            sid: {
                "eligible": True,
                "summary": {"total": 1, "passed": 1},
                "criterion_scores": {"contract_compliance": {"score": 100, "coverage": 1}},
            }
            for sid in ("sub-a", "sub-b")
        }
        state = {
            "blind_map": {"Candidate-A": "sub-a", "Candidate-B": "sub-b"},
            "submissions": {
                "sub-a": {"status": "ACTIVE", "content_hash": "a"},
                "sub-b": {"status": "ACTIVE", "content_hash": "b"},
            },
            "test_results": tests,
            "reviews": reviews,
            "participants": {},
            "participant_active_review": {},
        }
        result = aggregate_votes(packet, state)
        self.assertEqual(result["provisional_winner"], "Candidate-A")
        candidate_a = next(row for row in result["candidates"] if row["blind_label"] == "Candidate-A")
        self.assertEqual(candidate_a["criterion_scores"][peer_ids[0]]["score"], 90.0)
        self.assertTrue(any("OUTLIER_SCORES_PRESENT" in audit["flags"] for audit in result["reviewer_audit"]))


    def test_blind_review_manifest_hides_authorship_prose_and_internal_metadata(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            arena = locked_arena(temp, "blind-redaction")
            for participant in ("one", "two"):
                source = Path(temp) / f"blind-source-{participant}"
                source.mkdir()
                (source / "result.txt").write_text(
                    f"candidate artifact from {participant}", encoding="utf-8"
                )
                manifest = manifest_for(arena, "blind-redaction", participant)
                manifest.update(
                    {
                        "summary": f"I am participant {participant}",
                        "claims": {"author": participant, "special_method": True},
                        "notes": [f"private note by {participant}"],
                    }
                )
                manifest["artifacts"][0]["provenance"].update(
                    {
                        "source_refs": [f"private://{participant}"],
                        "creator": participant,
                    }
                )
                arena.submit("blind-redaction", participant, source, manifest)

            arena.close_submissions("blind-redaction")
            arena.run_deterministic_checks("blind-redaction")
            arena.open_review("blind-redaction")
            packet = arena.review_packet("blind-redaction", "one")
            self.assertEqual(packet["schema_version"], "axm.challenge-review-packet/0.4")
            self.assertTrue(packet["rules"]["direct_authorship_metadata_hidden"])
            self.assertEqual(len(packet["candidates"]), 1)

            blind_manifest = packet["candidates"][0]["manifest"]
            forbidden = {
                "participant_id",
                "submission_id",
                "submitted_at",
                "content_hash",
                "artifact_set_hash",
                "summary",
                "claims",
                "notes",
                "provenance",
            }
            self.assertTrue(forbidden.isdisjoint(blind_manifest))
            self.assertTrue(
                blind_manifest["submission_statement"]["hidden_for_blind_review"]
            )
            self.assertNotIn(
                "private://two", json.dumps(blind_manifest, sort_keys=True)
            )
            artifact = blind_manifest["artifacts"][0]
            self.assertNotIn("provenance", artifact)
            self.assertEqual(
                artifact["provenance_summary"]["source_reference_count"], 1
            )

    def test_followup_copies_inputs_and_detects_child_evidence_tampering(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            run_demo(temp)
            arena = ChallengeArena(temp)
            result = arena.spawn_followup(
                "arena-demo-001",
                "arena-demo-portable-child",
                mode="BEAT_WINNER",
            )
            receipt = result["lineage_input_receipt"]
            self.assertIsNotNone(receipt)
            self.assertTrue(receipt["copied"])
            self.assertEqual(
                receipt["authority"], "evidence-copy-only-not-approval"
            )
            child_dir = arena.store.challenge_dir("arena-demo-portable-child")
            copied_files: list[Path] = []
            for reference in receipt["inputs"]:
                self.assertEqual(
                    reference["artifact_root_scope"],
                    "relative_to_challenge_directory",
                )
                root = child_dir / reference["artifact_root"]
                self.assertTrue(root.is_dir())
                for file_entry in reference["artifact_files"]:
                    copied = root / file_entry["path"]
                    self.assertTrue(copied.is_file())
                    copied_files.append(copied)
            self.assertTrue(copied_files)
            self.assertTrue(
                arena.verify_integrity("arena-demo-portable-child")["valid"]
            )

            copied_files[0].write_bytes(copied_files[0].read_bytes() + b"tamper")
            verification = arena.verify_integrity("arena-demo-portable-child")
            self.assertFalse(verification["valid"])
            self.assertTrue(
                any(
                    "lineage input" in error and "hash mismatch" in error
                    for error in verification["errors"]
                )
            )

    def test_capabilities_expose_boundaries_and_complete_validator_surface(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            capabilities = ChallengeArena(temp).capabilities()
            self.assertEqual(
                capabilities["schema_version"],
                "axm.challenge-arena-capabilities/0.5",
            )
            self.assertEqual(capabilities["arena_version"], "0.6.0")
            validators = capabilities["deterministic_validators"]
            self.assertEqual(len(validators), 28)
            self.assertEqual(validators, sorted(validators))
            self.assertIn("external_receipt", validators)
            self.assertIn("deterministic_command", validators)
            boundaries = capabilities["authority_boundaries"]
            self.assertFalse(boundaries["automatic_merge"])
            self.assertFalse(boundaries["automatic_human_decision"])
            self.assertFalse(boundaries["candidate_execution_default"])
            self.assertFalse(boundaries["hmac_receipt_proves_measurement_truth"])


if __name__ == "__main__":
    unittest.main()
