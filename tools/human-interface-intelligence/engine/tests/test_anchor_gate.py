from __future__ import annotations

import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED

import jsonschema

from axm_hii.anchor import evaluate_anchor
from axm_hii.canonical import DuplicateKeyError, canonical_sha256, canonicalize, loads
from axm_hii.paired import run_paired_gate
from axm_hii.util import CONTRACT_ROOT

ROOT = Path(__file__).resolve().parents[1]


def _hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _make_anchor(
    target: Path,
    *,
    schema_mismatch: bool = False,
    lowercase_states: bool = False,
    evidence_failures: int = 0,
    include_extra_metadata_policy: bool = False,
) -> Path:
    root = "AXM_HUMAN_CAPABILITY_ATLAS_STABLE_HANDOFF_ANCHOR_v0_1_0"
    capability_hash = _hash(CONTRACT_ROOT / "schemas" / "capability-interface-contract.schema.json")
    recommendation_hash = _hash(CONTRACT_ROOT / "schemas" / "interface-recommendation.schema.json")
    if schema_mismatch:
        capability_hash = "0" * 64

    state_rows = {
        "KNOWN": "known" if lowercase_states else "KNOWN",
        "INFERRED": "inferred" if lowercase_states else "INFERRED",
        "UNKNOWN": "unknown" if lowercase_states else "UNKNOWN",
        "CONFLICTED": "conflicted" if lowercase_states else "CONFLICTED",
        "NOT_APPLICABLE": "not_applicable" if lowercase_states else "NOT_APPLICABLE",
    }
    policy_lines = ["# Evidence policy", "", "| Stable meaning | Serialized token |", "|---|---|"]
    policy_lines += [f"| {name} | `{token}` |" for name, token in state_rows.items()]
    policy_lines += ["", "Every inference includes reasoning, source basis, and confidence."]
    if include_extra_metadata_policy:
        policy_lines += ["Every inference also includes an evidence reference and producer/build identity."]

    fixtures = []
    evidence_records = []
    for index in range(10):
        capability_id = f"axm.fixture.{index}"
        fixtures.append({
            "fixture_name": f"fixture {index}",
            "capability_id": capability_id,
            "immutable_source_identity": {"capability_id": capability_id},
            "required_provenance_condition": {},
            "expected_evidence_states": {},
            "required_unknowns": [],
            "required_conflict_handling": "None.",
            "expected_schema_validation_state": {
                "source_capability_schema": "PASS",
                "shared_capability_record_schema": "PASS",
            },
        })
        policy_status = "FAIL" if index < evidence_failures else "PASS"
        evidence_records.append({
            "capability_id": capability_id,
            "validation": {
                "shared_capability_schema": "PASS",
                "stable_fixture_invariants": "PASS",
                "stable_anchor_evidence_policy": policy_status,
            },
        })

    authority_fields = {
        "contract_version": {"authority": "SHARED_CONTRACT_OWNED"},
        "capability_id": {"authority": "SOURCE_AUTHORITATIVE"},
        "capability_revision": {"authority": "SOURCE_AUTHORITATIVE"},
        "source_reference": {"authority": "DERIVED_WITH_EVIDENCE"},
        "identity.machine_name": {"authority": "SOURCE_AUTHORITATIVE"},
        "identity.human_name": {"authority": "ATLAS_EXPLANATORY"},
        "purpose": {"authority": "ATLAS_EXPLANATORY"},
        "task_profile": {"authority": "DERIVED_WITH_EVIDENCE"},
        "input_profile": {"authority": "SOURCE_AUTHORITATIVE"},
        "output_profile": {"authority": "SOURCE_AUTHORITATIVE"},
        "cost_profile": {"authority": "DERIVED_WITH_EVIDENCE"},
        "risk_profile": {"authority": "DERIVED_WITH_EVIDENCE"},
        "maturity_profile": {"authority": "DERIVED_WITH_EVIDENCE"},
        "learning_profile": {"authority": "ATLAS_EXPLANATORY"},
        "interaction_profile": {"authority": "DERIVED_WITH_EVIDENCE"},
        "interface_requirements": {"authority": "DERIVED_WITH_EVIDENCE"},
        "relationships": {"authority": "DERIVED_WITH_EVIDENCE"},
        "evidence_annotations": {"authority": "SHARED_CONTRACT_OWNED"},
        "module_two_interface_recommendation": {"authority": "FORBIDDEN_TO_REDEFINE"},
    }
    authority_values = {
        value: value for value in [
            "SOURCE_AUTHORITATIVE",
            "ATLAS_EXPLANATORY",
            "SHARED_CONTRACT_OWNED",
            "DERIVED_WITH_EVIDENCE",
            "FORBIDDEN_TO_REDEFINE",
        ]
    }
    guarantee_ids = [
        "canonical_schema_validation",
        "source_identity_preserved",
        "unknowns_explicit",
        "inferences_marked",
        "conflicts_preserved",
        "module_boundary",
        "no_private_contract_extension",
        "explanation_does_not_rewrite_source",
        "validation_failures_visible",
    ]
    vectors = {
        "canonicalization_profile": "AXM-CJ-1",
        "profile_version": "1.0.0",
        "vectors": [
            {
                "id": "key_order_decimal_unicode_nfc",
                "input_json": "{\"b\":2.500,\"a\":\"e\\u0301\"}",
                "expected_canonical": "{\"a\":\"é\",\"b\":2.5}",
                "canonical_sha256": "0c11e427b895bd31bef2b758889d106f3ec4a9f3028b4e380ec4567ec5f65606",
            },
            {
                "id": "unicode_key_normalization_collision",
            },
        ],
    }
    manifest = {
        "package_identifier": "axm.handoff.human-capability-atlas.stable-anchor",
        "package_version": "0.1.0",
        "atlas_module_identifier": "axm.module.human_capability_atlas",
        "atlas_version": "0.test.0",
        "atlas_build_identifier": "test-build",
        "shared_contract": {
            "identifier": "axm.capability-interface-contract",
            "version": "0.1.0",
            "supported_version_range": "==0.1.0",
        },
        "shared_schema_sha256_hashes": {
            "shared_capability.schema.json": {"sha256": capability_hash},
            "source_capability.schema.json": {"sha256": "1" * 64},
            "interface_recommendation.schema.json": {"sha256": recommendation_hash},
        },
        "producer_execution_state": {"state": "RUN"},
    }
    module_identity = {
        "stable_module_identifier": "axm.module.human_capability_atlas",
        "shared_contract": {
            "identifier": "axm.capability-interface-contract",
            "version_consumed": "0.1.0",
        },
    }
    contents: dict[str, bytes] = {
        "MODULE_IDENTITY.json": (json.dumps(module_identity, indent=2) + "\n").encode(),
        "FIELD_AUTHORITY_MAP.json": (json.dumps({
            "authority_values": authority_values,
            "fields": authority_fields,
        }, indent=2) + "\n").encode(),
        "CAPABILITY_IDENTITY_POLICY.md": b"# Identity policy\n",
        "PROVENANCE_AND_HASH_POLICY.json": b"{}\n",
        "EVIDENCE_STATE_POLICY.md": ("\n".join(policy_lines) + "\n").encode(),
        "PRODUCER_STATE_POLICY.md": b"# Producer state policy\n",
        "EXPORT_GUARANTEES.json": (json.dumps({
            "guarantees": [{"id": item, "statement": item} for item in guarantee_ids]
        }, indent=2) + "\n").encode(),
        "COMPATIBILITY_POLICY.md": b"# Compatibility policy\n",
        "STABLE_FIXTURE_INVARIANTS.json": (json.dumps({
            "fixture_count": 10,
            "fixtures": fixtures,
        }, indent=2) + "\n").encode(),
        "ATLAS_FIXTURE_RUN_EVIDENCE.json": (json.dumps({
            "records": evidence_records,
        }, indent=2) + "\n").encode(),
        "CANONICALIZATION_TEST_VECTORS.json": (json.dumps(vectors, indent=2, ensure_ascii=False) + "\n").encode(),
        "atlas_stable_handoff_manifest.json": (json.dumps(manifest, indent=2) + "\n").encode(),
        "VALIDATION_REPORT.md": b"# Validation report\n",
    }
    inventory = {
        "inventory_version": "0.1.0",
        "package_name": root,
        "hash_algorithm": "SHA-256",
        "self_hash_excluded": True,
        "files": [
            {"path": name, "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}
            for name, payload in sorted(contents.items())
        ],
    }
    contents["FILE_INVENTORY_SHA256.json"] = (json.dumps(inventory, indent=2) + "\n").encode()

    with ZipFile(target, "w", ZIP_DEFLATED) as archive:
        for name, payload in contents.items():
            archive.writestr(f"{root}/{name}", payload)
    return target


def test_axm_cj_1_vectors_and_collision() -> None:
    value = loads('{"b":2.500,"a":"e\\u0301"}')
    assert canonicalize(value) == '{"a":"é","b":2.5}'
    assert canonical_sha256(value) == "0c11e427b895bd31bef2b758889d106f3ec4a9f3028b4e380ec4567ec5f65606"
    try:
        canonicalize({"é": 1, "e\u0301": 2})
    except DuplicateKeyError:
        pass
    else:
        raise AssertionError("Expected NFC duplicate collision to be rejected")


def test_compatible_anchor_passes(tmp_path: Path) -> None:
    anchor = _make_anchor(tmp_path / "anchor.zip")
    report = evaluate_anchor(anchor, generated_at="2026-08-05T00:00:00Z")
    assert report["overall_status"] == "PASS"
    assert report["strict_merge_status"] == "PASS"


def test_schema_mismatch_blocks(tmp_path: Path) -> None:
    anchor = _make_anchor(tmp_path / "anchor.zip", schema_mismatch=True)
    report = evaluate_anchor(anchor, generated_at="2026-08-05T00:00:00Z")
    assert report["strict_merge_status"] == "BLOCKED"
    finding = next(item for item in report["findings"] if item["id"] == "shared_schema_byte_identity")
    assert finding["status"] == "CONFLICTED"


def test_lowercase_state_fork_blocks(tmp_path: Path) -> None:
    anchor = _make_anchor(tmp_path / "anchor.zip", lowercase_states=True)
    report = evaluate_anchor(anchor, generated_at="2026-08-05T00:00:00Z")
    finding = next(item for item in report["findings"] if item["id"] == "evidence_state_serialization")
    assert finding["status"] == "CONFLICTED"
    assert report["strict_merge_status"] == "BLOCKED"


def test_policy_failures_hold_merge(tmp_path: Path) -> None:
    anchor = _make_anchor(tmp_path / "anchor.zip", evidence_failures=2)
    report = evaluate_anchor(anchor, generated_at="2026-08-05T00:00:00Z")
    assert report["overall_status"] == "TEST-HOLD-REVIEW"
    assert report["strict_merge_status"] == "BLOCKED"


def test_unrepresentable_private_metadata_blocks(tmp_path: Path) -> None:
    anchor = _make_anchor(tmp_path / "anchor.zip", include_extra_metadata_policy=True)
    report = evaluate_anchor(anchor, generated_at="2026-08-05T00:00:00Z")
    finding = next(item for item in report["findings"] if item["id"] == "strict_inference_metadata_representability")
    assert finding["status"] == "CONFLICTED"


def test_paired_gate_does_not_consume_records_when_anchor_blocked(tmp_path: Path) -> None:
    anchor = _make_anchor(tmp_path / "anchor.zip", schema_mismatch=True)
    batch = {
        "handoff_id": "test-handoff",
        "handoff_version": "0.2.0",
        "contract_id": "axm.capability-interface-contract",
        "contract_version": "0.1.0",
        "producer": {
            "module_id": "axm.module.human_capability_atlas",
            "module_version": "0.test.0",
            "execution_state": "RUN",
        },
        "generated_at": "2026-08-05T00:00:00Z",
        "records": [{"item_id": "not-consumed"}],
    }
    report = run_paired_gate(batch, anchor, generated_at="2026-08-05T00:00:00Z")
    assert report["overall_status"] == "BLOCKED"
    assert report["recommendation_execution_state"] == "NOT_RUN"
    assert report["cross_module_report"] is None


def test_actual_anchor_report_conforms_to_report_schema() -> None:
    report_path = ROOT / "integration" / "anchor" / "MODULE_ONE_ANCHOR_COMPATIBILITY_REPORT.json"
    schema_path = ROOT / "integration" / "schemas" / "module-one-anchor-report.schema.json"
    report = json.loads(report_path.read_text())
    schema = json.loads(schema_path.read_text())
    jsonschema.Draft202012Validator(schema).validate(report)
    assert report["strict_merge_status"] == "BLOCKED"


def test_unsafe_zip_path_is_rejected(tmp_path: Path) -> None:
    target = tmp_path / "unsafe.zip"
    with ZipFile(target, "w", ZIP_DEFLATED) as archive:
        archive.writestr("anchor/../escape.json", b"{}")
    report = evaluate_anchor(target, generated_at="2026-08-05T00:00:00Z")
    assert report["overall_status"] == "FAIL"
    assert report["strict_merge_status"] == "BLOCKED"


def test_symbolic_link_zip_member_is_rejected(tmp_path: Path) -> None:
    target = tmp_path / "symlink.zip"
    info = ZipInfo("anchor/link")
    info.create_system = 3
    info.external_attr = (0o120777 << 16)
    with ZipFile(target, "w") as archive:
        archive.writestr(info, "target")
    report = evaluate_anchor(target, generated_at="2026-08-05T00:00:00Z")
    assert report["overall_status"] == "FAIL"
    assert report["strict_merge_status"] == "BLOCKED"
