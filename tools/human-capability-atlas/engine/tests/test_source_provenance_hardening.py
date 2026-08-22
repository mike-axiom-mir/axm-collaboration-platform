from pathlib import Path
import json
import hashlib
import pytest

from axm_capability_atlas.adapters import load_source_document
from axm_capability_atlas.atlas import build_card
from axm_capability_atlas.conformance import (
    validate_stable_provenance_policy,
    validate_stable_handoff_card,
)


def test_duplicate_json_keys_are_rejected(tmp_path):
    path = tmp_path / "duplicate.json"
    path.write_text(
        '{"capability_id":"axm.one","capability_id":"axm.two","machine_name":"x","description":"y"}',
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="Duplicate JSON object key"):
        load_source_document(path)


def test_duplicate_jsonl_keys_are_rejected(tmp_path):
    path = tmp_path / "duplicate.jsonl"
    path.write_text(
        '{"id":"axm.one","id":"axm.two","name":"x","description":"y"}\n',
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="Duplicate JSON object key"):
        load_source_document(path)


def test_declared_source_hash_must_match_accessible_source_bytes(tmp_path):
    source_path = tmp_path / "source.json"
    source = {
        "capability_id": "axm.hash.verify",
        "revision": "1",
        "machine_name": "hash_verify",
        "description": "Hash verification.",
        "why_it_matters": "Protects source provenance.",
        "examples": ["Example"],
    }
    source_path.write_text(json.dumps(source), encoding="utf-8")
    card = build_card(source, source_path)
    assert validate_stable_provenance_policy(card) == []

    card["source_reference"]["source_hash"] = "0" * 64
    issues = validate_stable_provenance_policy(card)
    assert any("does not match" in issue for issue in issues)


def test_unavailable_external_source_is_not_strictly_verified(tmp_path):
    source_path = tmp_path / "source.json"
    source = {
        "capability_id": "axm.external.unverified",
        "revision": "1",
        "machine_name": "external_unverified",
        "description": "External provenance test.",
        "why_it_matters": "Prevents fake verified provenance.",
        "examples": ["Example"],
        "source_reference": {
            "source_type": "manifest",
            "source_location": "https://example.invalid/source.json",
            "source_hash": "1" * 64,
            "confidence": 0.5,
        },
    }
    # build_card preserves the declared external reference.
    card = build_card(source, source_path)
    result = validate_stable_handoff_card(card)
    assert result["valid"] is False
    assert result["stable_provenance_policy"]["status"] == "FAIL"
