#!/usr/bin/env python3
from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any

@dataclass(frozen=True)
class IntakeGates:
    artifact_bytes_present: bool = False
    outer_hash_matches: bool = False
    archive_probe_passed: bool = False
    nested_hashes_match: bool = False
    exact_contract_match: bool = False
    source_discovery_valid: bool = False
    public_intake_ready: bool = False
    real_registry_run: bool = False
    receipts_valid: bool = False
    zero_missing_records: bool = False
    zero_extra_records: bool = False
    production_complete_verified: bool = False
    cross_module_compatible: bool = False
    merge_gate_passed: bool = False


def evaluate(g: IntakeGates) -> dict[str, Any]:
    package_checks = [
        g.artifact_bytes_present,
        g.outer_hash_matches,
        g.archive_probe_passed,
        g.nested_hashes_match,
        g.exact_contract_match,
    ]
    materialization_checks = [
        g.source_discovery_valid,
        g.public_intake_ready,
        g.real_registry_run,
        g.receipts_valid,
        g.zero_missing_records,
        g.zero_extra_records,
        g.production_complete_verified,
    ]

    if not g.artifact_bytes_present:
        state = "WAITING_FOR_ARTIFACT_BYTES"
    elif not all(package_checks):
        state = "PACKAGE_HOLD"
    elif not any(materialization_checks):
        state = "PACKAGE_REHEARSAL_PASS_MATERIALIZATION_REQUIRED"
    elif not all(materialization_checks):
        state = "MATERIALIZATION_HOLD"
    elif not g.cross_module_compatible:
        state = "CORPUS_REHEARSAL_PASS_CROSS_MODULE_REVIEW_REQUIRED"
    elif not g.merge_gate_passed:
        state = "MERGE_REVIEW_READY"
    else:
        state = "MERGE_GATE_PASSED"

    result = {
        "schema": "axm.gei.module1-materialization-state/v1",
        "state": state,
        "gates": asdict(g),
        "package_admission_eligible": all(package_checks),
        "materialization_required": not all(materialization_checks),
        "corpus_rehearsal_complete": all(materialization_checks),
        "merge_review_eligible": all(materialization_checks) and g.cross_module_compatible,
        "merge_gate_passed": g.merge_gate_passed,
        "automatic_execution_authority": False,
        "automatic_merge_authority": False,
        "truth_boundary": [
            "Package admission and corpus materialization are independent gates.",
            "COMPLETE_VERIFIED is not runtime capability proof.",
            "Cross-module compatibility is not Merge Gate acceptance.",
            "No state returned by this evaluator executes commands or mutates Module 1.",
        ],
    }
    return result


if __name__ == "__main__":
    import json
    print(json.dumps(evaluate(IntakeGates()), indent=2, sort_keys=True))
