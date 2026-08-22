from __future__ import annotations

import json
import os
import shutil
import stat
import tempfile
import unittest
import warnings
import zipfile
from pathlib import Path
from typing import Callable

from axm_challenge_arena import ChallengeArena, verify_evidence_bundle
from axm_challenge_arena.demo import run_demo
from axm_challenge_arena.utils import sha256_bytes, sha256_json


def _json_bytes(value: object) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False)
        + "\n"
    ).encode("utf-8")


def _rewrite(
    archive_path: Path,
    transform: Callable[[str, bytes], tuple[str, bytes] | None],
) -> None:
    replacement = archive_path.with_suffix(".rewrite.zip")
    with zipfile.ZipFile(archive_path, "r") as source, zipfile.ZipFile(
        replacement, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
    ) as target:
        for info in source.infolist():
            result = transform(info.filename, source.read(info))
            if result is None:
                continue
            name, payload = result
            copied = zipfile.ZipInfo(name, info.date_time)
            copied.compress_type = info.compress_type
            copied.comment = info.comment
            copied.extra = info.extra
            copied.internal_attr = info.internal_attr
            copied.external_attr = info.external_attr
            copied.create_system = info.create_system
            copied.flag_bits = info.flag_bits & ~0x1
            target.writestr(copied, payload)
    os.replace(replacement, archive_path)


def _rewrite_challenge_entry(
    archive_path: Path,
    challenge_name: str,
    mutate: Callable[[bytes], bytes],
    *,
    keep_manifest_semantic_hash: bool = True,
) -> None:
    with zipfile.ZipFile(archive_path, "r") as archive:
        entries = {info.filename: archive.read(info) for info in archive.infolist()}
    target_name = f"challenge/{challenge_name}"
    entries[target_name] = mutate(entries[target_name])
    manifest = json.loads(entries["BUNDLE-MANIFEST.json"])
    for item in manifest["files"]:
        if item["path"] == challenge_name:
            item["bytes"] = len(entries[target_name])
            item["sha256"] = sha256_bytes(entries[target_name])
            break
    else:
        raise AssertionError(f"No manifest entry for {challenge_name}")
    manifest["total_source_bytes"] = sum(item["bytes"] for item in manifest["files"])
    manifest["challenge_tree_hash"] = sha256_json(manifest["files"])
    if not keep_manifest_semantic_hash and challenge_name == "state.json":
        state = json.loads(entries[target_name])
        # This helper does not import the runtime semantic hash algorithm; callers
        # normally leave the old hash to verify that the receiver detects drift.
        manifest["snapshot_updated_at"] = state.get("updated_at")
    core = {key: value for key, value in manifest.items() if key != "bundle_manifest_hash"}
    manifest["bundle_manifest_hash"] = sha256_json(core)
    entries["BUNDLE-MANIFEST.json"] = _json_bytes(manifest)

    def transform(name: str, payload: bytes) -> tuple[str, bytes] | None:
        return name, entries[name]

    _rewrite(archive_path, transform)


class V04BundleVerifierTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._fixture = tempfile.TemporaryDirectory(prefix="axm-v04-bundle-fixture-")
        root = Path(cls._fixture.name)
        run_demo(root)
        cls.baseline = root / "baseline.zip"
        ChallengeArena(root).export_evidence_bundle("arena-demo-001", cls.baseline)
        baseline_report = verify_evidence_bundle(cls.baseline)
        if not baseline_report["valid"]:
            raise AssertionError(baseline_report)

    @classmethod
    def tearDownClass(cls) -> None:
        cls._fixture.cleanup()

    def _copy(self, temp: str, name: str = "bundle.zip") -> Path:
        destination = Path(temp) / name
        shutil.copy2(self.baseline, destination)
        return destination

    def test_valid_bundle_verifies_without_extracting(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)
            before = sorted(path.name for path in Path(temp).iterdir())
            report = verify_evidence_bundle(bundle)
            after = sorted(path.name for path in Path(temp).iterdir())
            self.assertTrue(report["valid"], report)
            self.assertFalse(report["extracted"])
            self.assertEqual(before, after)
            self.assertEqual(report["challenge_id"], "arena-demo-001")
            self.assertEqual(report["arena_version"], "0.6.0")
            self.assertEqual(len(report["integrity_report_sha256"]), 64)

    def test_changed_declared_file_fails_hash_and_tree_verification(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)
            with zipfile.ZipFile(bundle, "r") as archive:
                manifest = json.loads(archive.read("BUNDLE-MANIFEST.json"))
                target = next(
                    item["path"]
                    for item in manifest["files"]
                    if item["path"].endswith("result.md")
                )
            _rewrite(
                bundle,
                lambda name, payload: (
                    name,
                    payload + b"\nTAMPERED\n" if name == f"challenge/{target}" else payload,
                ),
            )
            report = verify_evidence_bundle(bundle)
            self.assertFalse(report["valid"])
            self.assertTrue(any("SHA-256 mismatch" in error for error in report["errors"]))
            self.assertTrue(any("challenge_tree_hash mismatch" in error for error in report["errors"]))

    def test_undeclared_challenge_member_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)
            with zipfile.ZipFile(bundle, "a", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.writestr("challenge/undeclared.txt", b"not in manifest")
            report = verify_evidence_bundle(bundle)
            self.assertFalse(report["valid"])
            self.assertTrue(any("undeclared challenge files" in error for error in report["errors"]))

    def test_manifest_self_hash_tamper_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)

            def transform(name: str, payload: bytes) -> tuple[str, bytes]:
                if name == "BUNDLE-MANIFEST.json":
                    value = json.loads(payload)
                    value["challenge_id"] = "changed-id"
                    return name, _json_bytes(value)
                return name, payload

            _rewrite(bundle, transform)
            report = verify_evidence_bundle(bundle)
            self.assertFalse(report["valid"])
            self.assertIn("bundle manifest hash mismatch", report["errors"])

    def test_v04_manifest_requires_integrity_tree_and_semantic_hashes(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)

            def transform(name: str, payload: bytes) -> tuple[str, bytes]:
                if name != "BUNDLE-MANIFEST.json":
                    return name, payload
                value = json.loads(payload)
                value.pop("integrity_report_sha256", None)
                value.pop("challenge_tree_hash", None)
                value.pop("semantic_state_hash", None)
                core = {
                    key: item
                    for key, item in value.items()
                    if key != "bundle_manifest_hash"
                }
                value["bundle_manifest_hash"] = sha256_json(core)
                return name, _json_bytes(value)

            _rewrite(bundle, transform)
            report = verify_evidence_bundle(bundle)
            self.assertFalse(report["valid"])
            self.assertGreaterEqual(
                sum("v0.4 bundle manifest is missing valid" in error for error in report["errors"]),
                3,
            )

    def test_integrity_report_is_bound_into_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)

            def transform(name: str, payload: bytes) -> tuple[str, bytes]:
                if name == "INTEGRITY-REPORT.json":
                    value = json.loads(payload)
                    value["valid"] = False
                    value["errors"] = ["invented report mutation"]
                    return name, _json_bytes(value)
                return name, payload

            _rewrite(bundle, transform)
            report = verify_evidence_bundle(bundle)
            self.assertFalse(report["valid"])
            self.assertIn("integrity report SHA-256 mismatch", report["errors"])
            self.assertIn("manifest integrity_valid does not match integrity report", report["errors"])

    def test_event_payload_tamper_is_detected_even_after_manifest_is_rehashed(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)
            with zipfile.ZipFile(bundle, "r") as archive:
                event_name = sorted(
                    name
                    for name in archive.namelist()
                    if name.startswith("challenge/events/") and name.endswith(".json")
                )[0]
            relative = event_name.removeprefix("challenge/")

            def mutate(payload: bytes) -> bytes:
                event = json.loads(payload)
                event["payload"]["tampered"] = True
                return _json_bytes(event)

            _rewrite_challenge_entry(bundle, relative, mutate)
            report = verify_evidence_bundle(bundle)
            self.assertFalse(report["valid"])
            self.assertTrue(any("event_hash mismatch" in error for error in report["errors"]))

    def test_event_filename_must_bind_sequence_and_event_hash(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)
            with zipfile.ZipFile(bundle, "r") as archive:
                event_name = sorted(
                    name
                    for name in archive.namelist()
                    if name.startswith("challenge/events/") and name.endswith(".json")
                )[0]
            renamed = event_name.replace("00000001-", "00000001-deadbeef-")
            _rewrite(
                bundle,
                lambda name, payload: (
                    (renamed, payload) if name == event_name else (name, payload)
                ),
            )
            report = verify_evidence_bundle(bundle)
            self.assertFalse(report["valid"])
            self.assertTrue(any("canonical event filename mismatch" in error for error in report["errors"]))

    def test_events_jsonl_projection_tamper_is_detected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)
            _rewrite_challenge_entry(
                bundle,
                "events.jsonl",
                lambda payload: payload + b'{"invented":true}\n',
            )
            report = verify_evidence_bundle(bundle)
            self.assertFalse(report["valid"])
            self.assertIn(
                "events.jsonl projection differs from canonical event files",
                report["errors"],
            )

    def test_state_semantic_drift_is_detected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)

            def mutate(payload: bytes) -> bytes:
                state = json.loads(payload)
                state["result"]["invented_field"] = "not event-bound"
                return _json_bytes(state)

            _rewrite_challenge_entry(bundle, "state.json", mutate)
            report = verify_evidence_bundle(bundle)
            self.assertFalse(report["valid"])
            self.assertTrue(
                any(
                    "semantic_state_hash" in error or "final event state_hash_after" in error
                    for error in report["errors"]
                ),
                report,
            )

    def test_duplicate_member_names_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                with zipfile.ZipFile(bundle, "a", compression=zipfile.ZIP_DEFLATED) as archive:
                    archive.writestr("BUNDLE-MANIFEST.json", b"{}")
            report = verify_evidence_bundle(bundle)
            self.assertFalse(report["valid"])
            self.assertTrue(any("duplicate member names" in error for error in report["errors"]))

    def test_traversal_member_is_rejected_without_extraction(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)
            with zipfile.ZipFile(bundle, "a") as archive:
                archive.writestr("../outside.txt", b"no")
            report = verify_evidence_bundle(bundle)
            self.assertFalse(report["valid"])
            self.assertTrue(any("unsafe archive member" in error for error in report["errors"]))
            self.assertFalse((Path(temp).parent / "outside.txt").exists())

    def test_symbolic_link_and_special_file_members_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)
            with zipfile.ZipFile(bundle, "a") as archive:
                link = zipfile.ZipInfo("link-entry")
                link.create_system = 3
                link.external_attr = (stat.S_IFLNK | 0o777) << 16
                archive.writestr(link, b"target")
                fifo = zipfile.ZipInfo("fifo-entry")
                fifo.create_system = 3
                fifo.external_attr = (stat.S_IFIFO | 0o644) << 16
                archive.writestr(fifo, b"")
            report = verify_evidence_bundle(bundle)
            self.assertFalse(report["valid"])
            self.assertTrue(any("symbolic-link" in error for error in report["errors"]))
            self.assertTrue(any("special-file" in error for error in report["errors"]))

    def test_portable_case_collision_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)
            with zipfile.ZipFile(bundle, "a") as archive:
                archive.writestr("Case.txt", b"one")
                archive.writestr("case.txt", b"two")
            report = verify_evidence_bundle(bundle)
            self.assertFalse(report["valid"])
            self.assertTrue(any("collision" in error.lower() for error in report["errors"]))

    def test_resource_limits_are_enforced_before_trust(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)
            report = verify_evidence_bundle(bundle, limits={"max_entries": 1})
            self.assertFalse(report["valid"])
            self.assertTrue(any("entries; limit is 1" in error for error in report["errors"]))
            report = verify_evidence_bundle(bundle, limits={"max_compression_ratio": 1.01})
            self.assertFalse(report["valid"])
            self.assertTrue(any("compression ratio" in error for error in report["errors"]))

    def test_invalid_limit_configuration_returns_a_failed_report(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)
            report = verify_evidence_bundle(bundle, limits={"unknown_limit": 1})
            self.assertFalse(report["valid"])
            self.assertTrue(any("unknown bundle verification limit" in error for error in report["errors"]))
            report = verify_evidence_bundle(bundle, limits={"max_entries": True})
            self.assertFalse(report["valid"])
            self.assertTrue(any("max_entries must be a positive integer" in error for error in report["errors"]))

    def test_duplicate_json_keys_in_manifest_are_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            bundle = self._copy(temp)

            def transform(name: str, payload: bytes) -> tuple[str, bytes]:
                if name == "BUNDLE-MANIFEST.json":
                    return name, b'{"schema_version":"axm.challenge-bundle/0.4","schema_version":"duplicate"}\n'
                return name, payload

            _rewrite(bundle, transform)
            report = verify_evidence_bundle(bundle)
            self.assertFalse(report["valid"])
            self.assertTrue(any("DuplicateJsonKeyError" in error for error in report["errors"]))


if __name__ == "__main__":
    unittest.main()
