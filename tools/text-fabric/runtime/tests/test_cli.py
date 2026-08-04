from pathlib import Path
from tempfile import TemporaryDirectory
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def run():
    env = dict(os.environ)
    env["PYTHONPATH"] = str(ROOT)
    with TemporaryDirectory() as tmp:
        output = Path(tmp) / "recipe"
        good = subprocess.run(
            [sys.executable, "-m", "axm_text_fabric.cli", "compile-target", "readable_glitch", str(output), "--platforms", "web"],
            cwd=ROOT,
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )
        assert good.returncode == 0, good.stderr
        assert "Traceback" not in good.stderr
        assert (output / "bundle_manifest.json").exists()

        bad = subprocess.run(
            [sys.executable, "-m", "axm_text_fabric.cli", "compile-target", "readble_glitch", str(Path(tmp) / "bad")],
            cwd=ROOT,
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )
        assert bad.returncode == 2
        assert bad.stderr.startswith("ERROR:")
        assert "Traceback" not in bad.stderr
        assert "readable_glitch" in bad.stderr

        stress = subprocess.run(
            [sys.executable, "-m", "axm_text_fabric.cli", "stress-text", "Hello {name}", "--mode", "all", "--pretty"],
            cwd=ROOT, env=env, text=True, capture_output=True, check=False,
        )
        assert stress.returncode == 0, stress.stderr
        assert "expanded" in stress.stdout and "{name}" in stress.stdout

        audit = subprocess.run(
            [sys.executable, "-m", "axm_text_fabric.cli", "layout-audit", "examples/request_layout_stress.json", "--pretty"],
            cwd=ROOT, env=env, text=True, capture_output=True, check=False,
        )
        assert audit.returncode in {0, 1}, audit.stderr
        assert "scenarios" in audit.stdout
