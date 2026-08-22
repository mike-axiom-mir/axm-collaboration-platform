#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
from pathlib import Path

from trio import (
    MODULE2,
    STATE_MAP,
    adapt_capability_record,
    build_status,
    contract_audit,
    digest_value,
)


def check(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


fixture = json.loads((MODULE2 / "shared-contract" / "fixtures" / "01_file_rename.json").read_text(encoding="utf-8"))
target = fixture["shared_capability_record"]
source = copy.deepcopy(target)
source.pop("contract_id")
source.pop("record_kind")
source.pop("evidence_annotations")
source["knowledge"] = {
    "field_states": {
        "/identity/human_name": "known",
        "/purpose/plain_explanation": "inferred",
        "/risk_profile/failure_modes": "unknown",
    },
    "inferences": [{
        "field": "/purpose/plain_explanation",
        "reasoning": "Fixture inference retained across the adapter.",
        "source_basis": "fixture",
        "confidence": 0.75,
        "evidence_reference": "fixture:01",
    }],
    "unknowns": ["/risk_profile/failure_modes"],
    "conflicts": [],
}

adapted, receipt = adapt_capability_record(source)
check(adapted["contract_id"] == "axm.capability-interface-contract", "target contract identity is explicit")
check(adapted["record_kind"] == "capability_record", "target record kind is explicit")
check([item["state"] for item in adapted["evidence_annotations"]] == ["KNOWN", "INFERRED", "UNKNOWN"], "truth-state mapping is deterministic")
check(receipt["retained_source_only"]["knowledge"] == source["knowledge"], "Module One knowledge is retained exactly")
check(receipt["truth"]["source_was_mutated"] is False, "adapter does not claim source mutation")
check(receipt["truth"]["native_contract_identity_claimed"] is False, "adapter does not claim native identity")
check(receipt["admission_state"] == "PLATFORM_TEST_READY", "validated translation is admitted to the versioned local test workflow")
check(receipt["review_state"] == "REVIEW_REQUIRED_FOR_CANON", "CANON still requires review")
check(receipt["bridge_contract"]["version"] == "1.0.0", "platform bridge contract is explicitly versioned")
check(receipt["receipt_sha256"] == digest_value({key: value for key, value in receipt.items() if key != "receipt_sha256"}), "receipt hash binds the adaptation")
check(STATE_MAP["conflicted"] == "CONFLICTED", "conflicts remain visible")

audit = contract_audit()
check(audit["overall"] == "CONFLICTED", "native schema collision remains visible")
check(all(item["status"] == "CONFLICTED" for item in audit["comparisons"]), "both shared schema surfaces are byte-conflicted")
status = build_status()
check(status["overall"] in {"WORKING_WITH_CONTRACT_HOLD", "INTEGRATED_WITH_NATIVE_CONTRACT_HOLD"}, "platform can work without hiding the contract hold")
check(status["module1_v011_probe"]["active_package_admission_safe"] is True, "Module One v0.11 rooted bundle passes the upgraded probe")
check(status["merge_gate"]["status"] == "HOLD", "selftest cannot grant Merge Gate")
check(status["truth"]["sources_mutated"] is False, "supplier sources remain immutable")

print("Capability intelligence trio selftest: PASS - 17 checks")
