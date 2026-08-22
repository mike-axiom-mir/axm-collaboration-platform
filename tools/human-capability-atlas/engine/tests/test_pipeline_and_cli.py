from pathlib import Path
import json
import os
import subprocess
import sys

from axm_capability_atlas.pipeline import build_from_file
from axm_capability_atlas.validators import validate_card

ROOT = Path(__file__).resolve().parents[1]


def test_pipeline_writes_complete_output(tmp_path):
    source = ROOT / "fixtures" / "source" / "file_rename.json"
    card = build_from_file(source, tmp_path / "built")
    expected = {
        "capability_card.json",
        "learning_atoms.json",
        "course_plan.json",
        "quick_view.md",
        "practical_view.md",
        "deep_view.md",
        "producer_receipt.json",
    }
    assert expected == {p.name for p in (tmp_path / "built").iterdir()}
    written = json.loads((tmp_path / "built" / "capability_card.json").read_text(encoding="utf-8"))
    assert written == card
    assert validate_card(written) == []


def test_cli_build_smoke(tmp_path):
    env = dict(os.environ)
    env["PYTHONPATH"] = str(ROOT / "src")
    result = subprocess.run(
        [sys.executable, "-m", "axm_capability_atlas.cli", "build",
         str(ROOT / "fixtures" / "source" / "file_rename.json"),
         "--output", str(tmp_path / "cli")],
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["status"] == "built"
    assert (tmp_path / "cli" / "capability_card.json").exists()
