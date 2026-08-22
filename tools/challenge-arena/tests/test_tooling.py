from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

from tools.build_release import build_release
from tools.sync_contract_resources import compare_schema_trees, sync_schema_trees


class ContractResourceToolTests(unittest.TestCase):
    def test_compare_reports_missing_extra_and_mismatched_without_modifying(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source"
            destination = root / "destination"
            source.mkdir()
            destination.mkdir()
            (source / "alpha.json").write_text('{"alpha":1}\n', encoding="utf-8")
            (source / "beta.json").write_text('{"beta":2}\n', encoding="utf-8")
            (destination / "alpha.json").write_text('{"alpha":9}\n', encoding="utf-8")
            (destination / "extra.json").write_text('{"extra":true}\n', encoding="utf-8")

            before = {p.name: p.read_bytes() for p in destination.iterdir()}
            differences = compare_schema_trees(source, destination)
            after = {p.name: p.read_bytes() for p in destination.iterdir()}

            self.assertEqual(differences["missing"], ["beta.json"])
            self.assertEqual(differences["extra"], ["extra.json"])
            self.assertEqual(differences["mismatched"], ["alpha.json"])
            self.assertEqual(before, after)

    def test_sync_repairs_missing_extra_and_mismatched_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source"
            destination = root / "destination"
            source.mkdir()
            destination.mkdir()
            (source / "alpha.json").write_text('{"alpha":1}\n', encoding="utf-8")
            (source / "beta.json").write_text('{"beta":2}\n', encoding="utf-8")
            (destination / "alpha.json").write_text('{"alpha":9}\n', encoding="utf-8")
            (destination / "extra.json").write_text('{"extra":true}\n', encoding="utf-8")

            count = sync_schema_trees(source, destination)

            self.assertEqual(count, 2)
            self.assertEqual(
                {p.name: p.read_bytes() for p in source.glob("*.json")},
                {p.name: p.read_bytes() for p in destination.glob("*.json")},
            )
            self.assertEqual(compare_schema_trees(source, destination), {
                "missing": [], "extra": [], "mismatched": []
            })

    def test_bundle_portability_audit_tool_runs_from_tools_directory(self) -> None:
        tool = Path(__file__).resolve().parents[1] / "tools" / "audit_bundle_portability.py"
        result = subprocess.run(
            [sys.executable, str(tool), "--cases", "2", "--seed", "7"],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        self.assertIn('"status": "PASS"', result.stdout)
        self.assertIn('"cases_completed": 2', result.stdout)

    def test_cli_check_is_read_only_and_release_members_are_sorted(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source"
            destination = root / "destination"
            source.mkdir()
            (source / "alpha.json").write_text('{"alpha":1}\n', encoding="utf-8")
            command = [
                sys.executable,
                str(Path(__file__).resolve().parents[1] / "tools" / "sync_contract_resources.py"),
                "--check",
                "--source",
                str(source),
                "--destination",
                str(destination),
            ]

            result = subprocess.run(command, capture_output=True, text=True, check=False)

            self.assertEqual(result.returncode, 1)
            self.assertIn("not synchronized", result.stdout)
            self.assertIn("missing: alpha.json", result.stdout)
            self.assertFalse(destination.exists())

            release_root = root / "release-root"
            (release_root / "axm_challenge_arena").mkdir(parents=True)
            (release_root / "pyproject.toml").write_text("[project]\nname='probe'\n", encoding="utf-8")
            (release_root / "axm_challenge_arena" / "version.py").write_text(
                '__version__ = "0.4.0"\n', encoding="utf-8"
            )
            (release_root / "z-last.txt").write_text("z", encoding="utf-8")
            (release_root / "A-first.txt").write_text("a", encoding="utf-8")
            archive_path = root / "release.zip"
            report = build_release(release_root, archive_path)
            with zipfile.ZipFile(archive_path) as archive:
                names = archive.namelist()
            self.assertEqual(names, sorted(names))
            self.assertTrue(report["members_lexically_sorted"])


if __name__ == "__main__":
    unittest.main()
