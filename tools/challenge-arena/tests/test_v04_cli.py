from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
import warnings
import zipfile
from pathlib import Path

from axm_challenge_arena import ChallengeArena
from axm_challenge_arena.demo import run_demo
from axm_challenge_arena.presets import generic_packet


ROOT = Path(__file__).resolve().parents[1]


def _run(*args: str, cwd: Path = ROOT) -> subprocess.CompletedProcess[str]:
    env = dict(os.environ)
    # Keep parent coverage instrumentation from leaking into the child CLI
    # process. The subprocess is the subject under test, not a nested coverage
    # worker, and inherited COVERAGE_RUN can make instrumentation environment-
    # dependent.
    env.pop("COVERAGE_RUN", None)
    env["PYTHONPATH"] = str(ROOT) + os.pathsep + env.get("PYTHONPATH", "")
    return subprocess.run(
        [sys.executable, "-m", "axm_challenge_arena", *args],
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


class V04CliTests(unittest.TestCase):
    def _locked(self, root: Path, challenge_id: str = "cli-seat") -> ChallengeArena:
        arena = ChallengeArena(root)
        packet = generic_packet(challenge_id, "CLI seat", "Exercise CLI orchestration.")
        packet["orchestration_policy"] = {"task_leases_required": True}
        arena.create_challenge(packet)
        arena.register_participant(challenge_id, "agent-a")
        arena.register_participant(challenge_id, "agent-b")
        arena.lock_challenge(challenge_id)
        return arena

    def test_help_and_version_are_runnable(self) -> None:
        help_result = _run("--help")
        self.assertEqual(help_result.returncode, 0, help_result.stderr)
        self.assertIn("claim-task", help_result.stdout)
        self.assertIn("verify-bundle", help_result.stdout)
        version = _run("--version")
        self.assertEqual(version.returncode, 0, version.stderr)
        self.assertIn("0.6.0", version.stdout)

    def test_task_claim_heartbeat_and_terminal_failure_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "workspace"
            self._locked(root)
            listed = _run("--root", str(root), "tasks", "cli-seat", "--phase", "BUILD")
            self.assertEqual(listed.returncode, 0, listed.stderr)
            task_list = json.loads(listed.stdout)
            self.assertEqual(task_list["schema_version"], "axm.challenge-seat-task-list/0.4")
            self.assertEqual(len(task_list["tasks"]), 2)

            claimed = _run(
                "--root", str(root), "claim-task", "cli-seat", "build-agent-a",
                "--worker", "agent-a", "--lease-seconds", "30",
            )
            self.assertEqual(claimed.returncode, 0, claimed.stderr)
            lease = json.loads(claimed.stdout)
            token = lease["lease_token"]
            self.assertNotIn(token, json.dumps(ChallengeArena(root).get("cli-seat")))

            heartbeat = _run(
                "--root", str(root), "heartbeat-task", "cli-seat", "build-agent-a", token,
                "--extend", "10", "--actor", "agent-a",
            )
            self.assertEqual(heartbeat.returncode, 0, heartbeat.stderr)
            self.assertEqual(json.loads(heartbeat.stdout)["heartbeat_count"], 1)

            failed = _run(
                "--root", str(root), "fail-task", "cli-seat", "build-agent-a", token,
                "--class", "MODEL_UNAVAILABLE", "--detail", "seat offline", "--no-retry",
                "--actor", "agent-a",
            )
            self.assertEqual(failed.returncode, 0, failed.stderr)
            self.assertEqual(json.loads(failed.stdout)["status"], "DEAD_LETTER")

    def test_workspace_verify_exit_code_tracks_integrity(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "workspace"
            run_demo(root)
            valid = _run("--root", str(root), "verify", "arena-demo-001")
            self.assertEqual(valid.returncode, 0, valid.stderr)
            self.assertTrue(json.loads(valid.stdout)["valid"])

            state_path = root / "challenges" / "arena-demo-001" / "state.json"
            value = json.loads(state_path.read_text(encoding="utf-8"))
            value["title_for_cli_tamper"] = "changed"
            state_path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            invalid = _run("--root", str(root), "verify", "arena-demo-001")
            self.assertEqual(invalid.returncode, 1, invalid.stderr)
            self.assertFalse(json.loads(invalid.stdout)["valid"])

    def test_bundle_verify_exit_code_tracks_validity(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "workspace"
            run_demo(root)
            bundle = Path(temp) / "evidence.zip"
            ChallengeArena(root).export_evidence_bundle("arena-demo-001", bundle)
            valid = _run("verify-bundle", str(bundle))
            self.assertEqual(valid.returncode, 0, valid.stderr)
            self.assertTrue(json.loads(valid.stdout)["valid"])

            bad = Path(temp) / "bad.zip"
            bad.write_bytes(bundle.read_bytes())
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                with zipfile.ZipFile(bad, "a", compression=zipfile.ZIP_DEFLATED) as archive:
                    archive.writestr("BUNDLE-MANIFEST.json", b"{}")
            invalid = _run("verify-bundle", str(bad))
            self.assertEqual(invalid.returncode, 1, invalid.stderr)
            self.assertFalse(json.loads(invalid.stdout)["valid"])


if __name__ == "__main__":
    unittest.main()
