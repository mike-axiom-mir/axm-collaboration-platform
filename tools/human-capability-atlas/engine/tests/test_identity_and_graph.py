from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import json
import os
import subprocess
import sys

from axm_capability_atlas.adapters import adapt_file
from axm_capability_atlas.graph import build_capability_graph, save_analysis
from axm_capability_atlas.identity import build_identity_report
from axm_capability_atlas.ingest import ingest_path
from axm_capability_atlas.validators import validate_capability_graph, validate_identity_report

ROOT = Path(__file__).resolve().parents[1]


def record(capability_id: str, *, revision="1.0.0", description="Capability", source="source.json", **extra):
    value = {
        "capability_id": capability_id,
        "revision": revision,
        "machine_name": capability_id.rsplit(".", 1)[-1],
        "description": description,
        "relationships": {},
        "learning_profile": {},
        "maturity_profile": {"proof_status": "declared"},
        "source_reference": {
            "source_type": "manifest",
            "source_location": source,
            "source_hash": source.replace("/", "-") or "hash",
            "source_pointer": "",
            "last_verified_at": "2026-08-05T00:00:00+00:00",
            "confidence": 0.9,
        },
    }
    value.update(extra)
    return value


def test_duplicate_revision_and_conflict_classification():
    exact_a = record("axm.same", source="a.json")
    exact_b = deepcopy(exact_a)
    exact_b["source_reference"] = {**exact_a["source_reference"], "source_location": "b.json", "source_hash": "b"}

    rev_a = record("axm.revision", revision="1.0.0", description="Old", source="r1.json")
    rev_b = record("axm.revision", revision="2.0.0", description="New", source="r2.json")

    conflict_a = record("axm.conflict", revision="1.0.0", description="One", source="c1.json")
    conflict_b = record("axm.conflict", revision="1.0.0", description="Two", source="c2.json")

    report = build_identity_report([exact_a, exact_b, rev_a, rev_b, conflict_a, conflict_b])
    groups = {item["capability_id"]: item for item in report["identity_groups"]}
    assert groups["axm.same"]["classification"] == "exact_duplicate"
    assert groups["axm.revision"]["classification"] == "revision_family"
    assert groups["axm.revision"]["canonical_selection"]["selected_revision"] == "2.0.0"
    assert groups["axm.conflict"]["classification"] == "conflicting_duplicate"
    assert groups["axm.conflict"]["review_required"] is True
    assert validate_identity_report(report) == []


def test_alias_collisions_and_shadowing_are_not_auto_resolved():
    a = record("axm.alpha", aliases=["shared", "axm.beta"])
    b = record("axm.beta", aliases=["shared"])
    report = build_identity_report([a, b])
    assert "shared" in report["aliases"]["collisions"]
    assert "shared" not in report["aliases"]["resolved"]
    assert report["summary"]["alias_shadowing_count"] == 1


def test_lifecycle_replacement_chain_and_broken_link():
    old = record("axm.old", lifecycle_profile={"status": "deprecated", "replaced_by": ["axm.new"]})
    new = record("axm.new", lifecycle_profile={"status": "active", "replaces": ["axm.old"]})
    broken = record("axm.broken", lifecycle_profile={"status": "replaced", "replaced_by": ["axm.missing"]})
    report = build_identity_report([old, new, broken])
    assert report["summary"]["replacement_link_count"] == 1
    assert report["summary"]["broken_lifecycle_link_count"] == 1
    assert report["lifecycle"]["replacement_links"][0]["from"] == "axm.old"
    assert report["lifecycle"]["replacement_links"][0]["to"] == "axm.new"


def test_graph_reports_cycles_missing_self_and_deprecated_targets():
    a = record("axm.a", relationships={"dependency_capability_ids": ["axm.b", "missing"]})
    b = record("axm.b", relationships={"dependency_capability_ids": ["axm.c"]})
    c = record("axm.c", relationships={"dependency_capability_ids": ["axm.a"]})
    self_ref = record("axm.self", relationships={"dependency_capability_ids": ["axm.self"]})
    old = record("axm.old", lifecycle_profile={"status": "deprecated"})
    consumer = record("axm.consumer", relationships={"dependency_capability_ids": ["legacy-old"]})
    old["aliases"] = ["legacy-old"]

    identity = build_identity_report([a, b, c, self_ref, old, consumer])
    graph = build_capability_graph([a, b, c, self_ref, old, consumer], identity)
    assert graph["summary"]["dependency_cycle_count"] == 2
    assert graph["summary"]["unresolved_reference_count"] == 1
    assert graph["summary"]["self_reference_count"] == 1
    assert graph["summary"]["deprecated_target_reference_count"] == 1
    consumer_edge = next(item for item in graph["edges"] if item["source"] == "axm.consumer")
    assert consumer_edge["target"] == "axm.old"
    assert consumer_edge["resolution"] == "alias"
    assert validate_capability_graph(graph) == []


def test_adapter_maps_alias_lifecycle_and_relationship_fields():
    detection, adapted = adapt_file(ROOT / "fixtures" / "identity" / "lifecycle_registry.json")
    assert detection.candidate_count == 3
    old = next(item.normalized for item in adapted if item.normalized and item.normalized["capability_id"] == "axm.identity.old-tool")
    assert old["aliases"] == ["old-tool", "axm.legacy.tool"]
    assert old["lifecycle_profile"]["status"] == "deprecated"
    assert old["lifecycle_profile"]["replaced_by"] == ["axm.identity.new-tool"]
    assert old["relationships"]["dependency_capability_ids"] == ["axm.identity.base"]


def test_ingestion_writes_identity_and_graph_reports(tmp_path):
    report = ingest_path(ROOT / "fixtures" / "identity", tmp_path / "out")
    assert report["analysis"]["identity"]["unique_capability_id_count"] == 3
    assert report["analysis"]["graph"]["node_count"] == 3
    assert (tmp_path / "out" / "analysis" / "identity_report.json").exists()
    assert (tmp_path / "out" / "analysis" / "capability_graph.json").exists()


def test_cli_analyze_smoke(tmp_path):
    records = [record("axm.cli.one"), record("axm.cli.two", relationships={"dependency_capability_ids": ["axm.cli.one"]})]
    normalized = tmp_path / "normalized_sources"
    normalized.mkdir()
    for index, item in enumerate(records):
        (normalized / f"{index}.json").write_text(json.dumps(item), encoding="utf-8")

    env = dict(os.environ)
    env["PYTHONPATH"] = str(ROOT / "src")
    result = subprocess.run(
        [sys.executable, "-m", "axm_capability_atlas.cli", "analyze", str(tmp_path), "--output", str(tmp_path / "analysis")],
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["status"] == "analyzed"
    assert payload["graph_summary"]["edge_count"] == 1


def test_identity_and_graph_handle_1800_records_deterministically():
    records = []
    for index in range(1800):
        dependencies = [] if index == 0 else [f"axm.scale.{index - 1}"]
        records.append(record(
            f"axm.scale.{index}",
            revision="1.0.0",
            source=f"scale/{index}.json",
            relationships={"dependency_capability_ids": dependencies},
        ))
    identity = build_identity_report(records)
    graph = build_capability_graph(records, identity)
    assert identity["summary"]["unique_capability_id_count"] == 1800
    assert identity["summary"]["duplicate_id_group_count"] == 0
    assert graph["summary"]["node_count"] == 1800
    assert graph["summary"]["edge_count"] == 1799
    assert graph["summary"]["dependency_cycle_count"] == 0
    assert len(graph["navigation"]["topological_order"]) == 1800
    assert graph["navigation"]["topological_order"][0] == "axm.scale.0"
