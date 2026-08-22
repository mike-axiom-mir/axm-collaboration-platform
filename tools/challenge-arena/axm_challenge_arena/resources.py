from __future__ import annotations

from importlib.resources import files
from typing import Any

from .utils import read_json


def schema_names() -> list[str]:
    """Return the JSON contract schemas bundled inside the installed wheel."""

    root = files("axm_challenge_arena").joinpath("schemas")
    return sorted(item.name for item in root.iterdir() if item.name.endswith(".json"))


def load_schema(name: str) -> dict[str, Any]:
    """Load one bundled contract schema by filename without accepting path traversal."""

    if not isinstance(name, str) or not name.endswith(".json") or "/" in name or "\\" in name or name in {".", ".."}:
        raise ValueError("Schema name must be one plain .json filename.")
    root = files("axm_challenge_arena").joinpath("schemas")
    target = root.joinpath(name)
    if not target.is_file():
        raise FileNotFoundError(f"Unknown bundled schema: {name}")
    value = read_json(target)
    if not isinstance(value, dict):
        raise ValueError(f"Bundled schema is not a JSON object: {name}")
    return value
