from __future__ import annotations
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class StructureTests(unittest.TestCase):
    def test_exactly_100_capsules(self):
        self.assertEqual(len(list((ROOT / "modules").glob("[0-9][0-9][0-9]_*"))), 100)

    def test_unique_ids_and_numbers(self):
        manifests = [json.loads((p / "module.json").read_text(encoding="utf-8")) for p in (ROOT / "modules").glob("[0-9][0-9][0-9]_*")]
        self.assertEqual({m["number"] for m in manifests}, set(range(1, 101)))
        self.assertEqual(len({m["id"] for m in manifests}), 100)

    def test_no_default_enabled(self):
        manifests = [json.loads((p / "module.json").read_text(encoding="utf-8")) for p in (ROOT / "modules").glob("[0-9][0-9][0-9]_*")]
        self.assertTrue(all(m["default_enabled"] is False for m in manifests))

    def test_no_network_or_native_writes(self):
        manifests = [json.loads((p / "module.json").read_text(encoding="utf-8")) for p in (ROOT / "modules").glob("[0-9][0-9][0-9]_*")]
        self.assertTrue(all(m["implementation"]["network_access"] is False for m in manifests))
        self.assertTrue(all(m["implementation"]["native_writes"] is False for m in manifests))

    def test_high_restraint_shadow_only(self):
        high = {43, 46, 48, 66, 68, 70, 74, 80, 94, 100}
        for path in (ROOT / "modules").glob("[0-9][0-9][0-9]_*"):
            manifest = json.loads((path / "module.json").read_text(encoding="utf-8"))
            if manifest["number"] in high:
                self.assertEqual(manifest["authority_mode"], "shadow_only")


if __name__ == "__main__":
    unittest.main()
