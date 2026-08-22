from __future__ import annotations
import json, subprocess, sys, unittest
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]

class Phase1SimulationTests(unittest.TestCase):
    def test_validation_script_passes(self):
        result = subprocess.run([sys.executable, str(BASE / "scripts" / "validate_phase1.py")], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, msg=result.stdout + "\n" + result.stderr)

    def test_pinned_snapshot_and_honest_boundary(self):
        snap = json.loads((BASE / "intake" / "GITHUB_SNAPSHOT.json").read_text())
        self.assertEqual(snap["commit"], "c2dbeb69c39e4bc38363edb58adc7d671378da22")
        self.assertFalse(snap["execution_boundary"]["repository_tests_executed_here"])
        self.assertFalse(snap["execution_boundary"]["repository_checkout_obtained"])

    def test_no_capability_is_silently_proven(self):
        for p in (BASE / "registry" / "capabilities").glob("*.json"):
            cap = json.loads(p.read_text())
            self.assertEqual(cap["proof_status"], "UNKNOWN")
            self.assertEqual(cap["declared_status"], "DECLARED")

    def test_known_conflicts_remain_visible(self):
        asset = json.loads((BASE / "registry" / "module_passports" / "asset-fabric.json").read_text())
        game = json.loads((BASE / "registry" / "module_passports" / "game-hub.json").read_text())
        platform = json.loads((BASE / "registry" / "module_passports" / "workshop-public-snapshot.json").read_text())
        self.assertEqual(asset["truth_state"], "CONFLICTED")
        self.assertEqual(game["truth_state"], "CONFLICTED")
        self.assertEqual(platform["truth_state"], "CONFLICTED")

if __name__ == "__main__":
    unittest.main()
