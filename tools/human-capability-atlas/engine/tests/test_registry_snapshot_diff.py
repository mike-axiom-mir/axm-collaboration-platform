from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import json
import os
import subprocess
import sys

from axm_capability_atlas.registry_diff import compare_registry_snapshots
from axm_capability_atlas.registry_snapshot import build_registry_snapshot
from axm_capability_atlas.ingest import ingest_path
from axm_capability_atlas.validators import validate_registry_diff, validate_registry_snapshot

ROOT = Path(__file__).resolve().parents[1]


def record(capability_id: str, *, description="Capability", revision="1.0.0", source=None, dependencies=None):
    source = source or f"{capability_id}.json"
    return {
        "capability_id": capability_id,
        "revision": revision,
        "machine_name": capability_id.rsplit(".", 1)[-1],
        "human_name": capability_id,
        "description": description,
        "why_it_matters": "It has a declared purpose.",
        "examples": ["Example"],
        "relationships": {"dependency_capability_ids": dependencies or []},
        "learning_profile": {"prerequisite_capability_ids": []},
        "source_reference": {
            "source_type": "manifest",
            "source_location": source,
            "source_hash": f"hash-{source}",
            "source_pointer": "",
            "last_verified_at": "2026-08-05T00:00:00+00:00",
            "confidence": 0.9,
        },
    }


def test_snapshot_is_deterministic_except_generation_time():
    records = [record("axm.one"), record("axm.two", dependencies=["axm.one"])]
    first = build_registry_snapshot(records)
    second = build_registry_snapshot(list(reversed(records)))
    assert first["snapshot_hash"] == second["snapshot_hash"]
    assert first["capabilities"] == second["capabilities"]
    assert first["summary"]["dependency_edge_count"] == 1
    assert first["capabilities"]["axm.one"]["direct_dependents"] == ["axm.two"]
    assert validate_registry_snapshot(first) == []


def test_diff_separates_source_only_change_from_semantic_change():
    old = record("axm.one")
    source_changed = deepcopy(old)
    source_changed["source_reference"]["source_hash"] = "new-source-hash"
    source_changed["source_reference"]["source_location"] = "moved/axm.one.json"

    before = build_registry_snapshot([old])
    after = build_registry_snapshot([source_changed])
    diff = compare_registry_snapshots(before, after)
    assert diff["source_only_changes"] == ["axm.one"]
    assert diff["rebuild_plan"]["rebuild_capability_cards"] == []
    assert diff["summary"]["id_reuse_risk_count"] == 0


def test_diff_flags_same_revision_semantic_change_and_plans_dependents():
    base_old = record("axm.base", description="Old meaning")
    child = record("axm.child", dependencies=["axm.base"])
    grandchild = record("axm.grandchild", dependencies=["axm.child"])
    before = build_registry_snapshot([base_old, child, grandchild])

    base_new = record("axm.base", description="Changed meaning", revision="1.0.0")
    after = build_registry_snapshot([base_new, child, grandchild])
    diff = compare_registry_snapshots(before, after)
    assert diff["summary"]["changed_count"] == 1
    assert diff["summary"]["id_reuse_risk_count"] == 1
    assert diff["id_reuse_risks"][0]["capability_id"] == "axm.base"
    assert diff["impact"]["affected_dependents"] == ["axm.child", "axm.grandchild"]
    assert set(diff["rebuild_plan"]["rebuild_learning_outputs"]) == {"axm.base", "axm.child", "axm.grandchild"}
    assert set(diff["rebuild_plan"]["rerun_human_interface_intelligence"]) == {"axm.base", "axm.child", "axm.grandchild"}
    assert validate_registry_diff(diff) == []


def test_diff_added_removed_and_relationship_changes():
    before = build_registry_snapshot([
        record("axm.keep"),
        record("axm.remove"),
    ])
    after = build_registry_snapshot([
        record("axm.keep", dependencies=["axm.add"]),
        record("axm.add"),
    ])
    diff = compare_registry_snapshots(before, after)
    assert diff["added"] == ["axm.add"]
    assert diff["removed"] == ["axm.remove"]
    changed = {item["capability_id"]: item for item in diff["changed"]}
    assert "relationships_changed" in changed["axm.keep"]["categories"]
    assert diff["rebuild_plan"]["rerun_identity_analysis"] is True
    assert diff["rebuild_plan"]["rerun_relationship_graph"] is True


def test_ingestion_writes_registry_snapshot(tmp_path):
    report = ingest_path(ROOT / "fixtures" / "identity", tmp_path / "out")
    snapshot_path = tmp_path / "out" / "registry_snapshot.json"
    assert snapshot_path.exists()
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    assert report["analysis"]["snapshot"]["capability_count"] == 3
    assert validate_registry_snapshot(snapshot) == []


def test_cli_snapshot_and_diff_smoke(tmp_path):
    before_dir = tmp_path / "before" / "normalized_sources"
    after_dir = tmp_path / "after" / "normalized_sources"
    before_dir.mkdir(parents=True)
    after_dir.mkdir(parents=True)
    before_record = record("axm.cli.snapshot")
    after_record = record("axm.cli.snapshot", description="Updated")
    (before_dir / "one.json").write_text(json.dumps(before_record), encoding="utf-8")
    (after_dir / "one.json").write_text(json.dumps(after_record), encoding="utf-8")

    env = dict(os.environ)
    env["PYTHONPATH"] = str(ROOT / "src")
    before_snapshot = tmp_path / "before.json"
    after_snapshot = tmp_path / "after.json"
    diff_path = tmp_path / "diff.json"
    for source, output in [(before_dir.parent, before_snapshot), (after_dir.parent, after_snapshot)]:
        result = subprocess.run(
            [sys.executable, "-m", "axm_capability_atlas.cli", "snapshot", str(source), "--output", str(output)],
            capture_output=True,
            text=True,
            env=env,
            check=False,
        )
        assert result.returncode == 0, result.stderr
    result = subprocess.run(
        [sys.executable, "-m", "axm_capability_atlas.cli", "diff", str(before_snapshot), str(after_snapshot), "--output", str(diff_path)],
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["summary"]["changed_count"] == 1
    assert diff_path.exists()


def test_snapshot_and_diff_handle_1800_capabilities():
    before_records = [
        record(f"axm.scale.{index}", dependencies=[] if index == 0 else [f"axm.scale.{index - 1}"])
        for index in range(1800)
    ]
    after_records = deepcopy(before_records)
    after_records[900]["description"] = "Updated capability meaning"
    before = build_registry_snapshot(before_records)
    after = build_registry_snapshot(after_records)
    diff = compare_registry_snapshots(before, after)
    assert before["summary"]["capability_count"] == 1800
    assert diff["summary"]["changed_count"] == 1
    assert diff["summary"]["affected_dependent_count"] == 899
