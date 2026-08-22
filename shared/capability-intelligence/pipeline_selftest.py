#!/usr/bin/env python3
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from pipeline import build_pipeline, digest_value


def check(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


with tempfile.TemporaryDirectory(prefix="axm-capability-pipeline-") as folder:
    output = Path(folder) / "verified-workflow"
    first = build_pipeline(output)
    first_hash = first["receipt_sha256"]
    first_recommendation = json.loads((output / "module2" / "interface_recommendation.json").read_text(encoding="utf-8"))
    first_signal = json.loads((output / "module3" / "signal_metabolism_report.json").read_text(encoding="utf-8"))
    second = build_pipeline(output)

    check(first["verdict"] == "PASS", "the three-module workflow passes")
    check(first["module1"]["status"] == "PASS", "Module 1 humanization passes")
    check(all(first["module1"]["checks"].values()), "every human-readability check passes")
    check(first["module1_to_module2"]["digest_match"] is True, "Module 1 sender and Module 2 receiver digests match")
    check(first["module2"]["checks"]["selected_interface_pattern_id"] == "searchable_library", "Module 2 selects the searchable-library pattern")
    check(first["module2"]["checks"]["assurance_status"] == "PASS", "Module 2 assurance passes")
    check(first["interface_application"]["checks"]["after_missing"] == [], "the real interface implements every required control")
    check(first["module2_to_module3"]["digest_match"] is True, "Module 3 receives the exact Module 2 recommendation digest")
    check(first["module3"]["checks"]["need_candidate_retained"] is True, "Module 3 retains the improvement candidate")
    check(first["module3"]["checks"]["authority_remains_closed"] is True, "Module 3 grants no authority")
    check(first["native_contract_boundary"]["status"] == "BLOCKED", "native schema conflict remains visible")
    check(first["supplier_source_stability"]["status"] == "PASS", "supplier engine trees remain unchanged")
    check(first_hash == second["receipt_sha256"], "same-path replay produces the same pipeline receipt")
    check(digest_value(first_recommendation) == first["module2_to_module3"]["sender_sha256"], "sender digest binds the recommendation bytes")
    check(first_signal["unique_signals"] == 2, "Module 3 retains gap and result separately")

print("Capability intelligence pipeline selftest: PASS - 15 checks")
