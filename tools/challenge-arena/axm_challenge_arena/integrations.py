from __future__ import annotations

from copy import deepcopy
from typing import Any

from .presets import build_preset


def packet_from_module_job(job: dict[str, Any]) -> dict[str, Any]:
    """Translate the stable neutral AXM module-job seam into a v0.5 packet.

    The adapter deliberately validates the envelope before applying overrides. This
    prevents a malformed producer job from being interpreted differently by separate
    Arena seats or from turning strings into character-by-character constraints.
    """
    if not isinstance(job, dict):
        raise ValueError("Module job must be a JSON object.")
    schema_version = job.get("schema_version", "axm.module-job/0.1")
    if schema_version != "axm.module-job/0.1":
        raise ValueError(
            f"Unsupported module-job schema {schema_version!r}; expected 'axm.module-job/0.1'."
        )
    required = ["job_id", "source_module", "artifact_kind", "title", "goal"]
    missing = [key for key in required if not isinstance(job.get(key), str) or not job[key].strip()]
    if missing:
        raise ValueError(f"Module job is missing non-empty string fields: {missing}")
    constraints = job.get("constraints", [])
    inputs = job.get("inputs", [])
    notes = job.get("notes", [])
    overrides = job.get("packet_overrides", {})
    if not isinstance(constraints, list) or not all(isinstance(item, str) for item in constraints):
        raise ValueError("Module job constraints must be a list of strings.")
    if not isinstance(inputs, list) or not all(isinstance(item, dict) for item in inputs):
        raise ValueError("Module job inputs must be a list of objects.")
    if not isinstance(notes, list) or not all(isinstance(item, str) for item in notes):
        raise ValueError("Module job notes must be a list of strings.")
    if not isinstance(overrides, dict):
        raise ValueError("Module job packet_overrides must be an object.")
    packet = build_preset(
        str(job["artifact_kind"]),
        challenge_id=str(job.get("challenge_id") or f"challenge-{job['job_id']}"),
        title=str(job["title"]),
        goal=str(job["goal"]),
        source_module=str(job["source_module"]),
        source_job_id=str(job["job_id"]),
    )
    packet["constraints"].extend(item.strip() for item in constraints if item.strip())
    packet["inputs"] = deepcopy(inputs)
    packet["notes"].extend(item.strip() for item in notes if item.strip())

    if overrides:
        # Explicit module-provided values win at the top level. No silent deep merge.
        for key, value in overrides.items():
            packet[key] = deepcopy(value)
    return packet


def module_job_template() -> dict[str, Any]:
    return {
        "schema_version": "axm.module-job/0.1",
        "job_id": "asset-job-001",
        "source_module": "asset_factory",
        "artifact_kind": "asset",
        "title": "Create a portal-world board",
        "goal": "Produce a separate lightweight game board asset with an unmistakable AXM multiverse identity.",
        "constraints": ["Local-first handoff", "Preserve source and rights provenance"],
        "inputs": [
            {
                "id": "brief",
                "kind": "file",
                "path": "relative/or/absolute/path/to/brief.txt",
                "sha256": "optional",
                "required": True,
            }
        ],
        "notes": [],
        "packet_overrides": {},
    }
