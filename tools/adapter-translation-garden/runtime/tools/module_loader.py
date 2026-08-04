from __future__ import annotations
import importlib.util
import json
from pathlib import Path
from types import ModuleType
import zoneinfo

ROOT = Path(__file__).resolve().parents[1]
_BUNDLED_TZPATH = ROOT.parent / "vendor" / "tzdata-2026b" / "zoneinfo"


def configure_local_runtime() -> None:
    """Add AXM's bounded IANA data without replacing any host timezone data."""
    if _BUNDLED_TZPATH.is_dir() and str(_BUNDLED_TZPATH) not in zoneinfo.TZPATH:
        zoneinfo.reset_tzpath((*zoneinfo.TZPATH, str(_BUNDLED_TZPATH)))


def module_folder(number: int) -> Path:
    matches = sorted((ROOT / "modules").glob(f"{number:03d}_*"))
    if len(matches) != 1:
        raise FileNotFoundError(f"Expected one module folder for {number}, found {len(matches)}")
    return matches[0]


def load_manifest(number: int) -> dict:
    return json.loads((module_folder(number) / "module.json").read_text(encoding="utf-8"))


def load_implementation(number: int) -> ModuleType:
    configure_local_runtime()
    path = module_folder(number) / "implementation.py"
    if not path.exists():
        raise RuntimeError(f"Module {number:03d} is contract-only")
    name = f"axm_detached_module_{number:03d}"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
