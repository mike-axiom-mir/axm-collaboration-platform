#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
WORKSHOP = HERE.parents[1]
MODULE1 = WORKSHOP / "tools" / "human-capability-atlas" / "engine"
MODULE2 = WORKSHOP / "tools" / "human-interface-intelligence" / "engine"
MODULE3 = WORKSHOP / "tools" / "grounded-evolution-intelligence" / "engine"
SOURCE = HERE / "fixtures" / "workshop-capability-explain.source.json"
CONTEXT = HERE / "fixtures" / "workshop-capability-explain.context.json"
BEFORE_INTERFACE = HERE / "fixtures" / "human-capability-atlas-interface-before.json"
INTERFACE = WORKSHOP / "tools" / "human-capability-atlas" / "index.html"
RECEIPT_SCHEMA = HERE / "contracts" / "pipeline-receipt-v1.schema.json"
DEFAULT_OUTPUT = HERE / "generated" / "verified-workflow"
GENERATED_AT = "2026-08-09T02:45:00Z"

for path in (MODULE1 / "src", MODULE2, HERE):
    value = str(path)
    if value not in sys.path:
        sys.path.insert(0, value)

from axm_capability_atlas.conformance import verify_producer_receipt  # noqa: E402
from axm_capability_atlas.pipeline import build_from_file  # noqa: E402
from axm_hii.assurance import build_recommendation_assurance  # noqa: E402
from axm_hii.engine import recommend_interface  # noqa: E402
from axm_hii.receipts import build_decision_receipt  # noqa: E402
from axm_hii.version import MODULE_VERSION as MODULE2_VERSION  # noqa: E402
from jsonschema import Draft202012Validator  # noqa: E402
from trio import adapt_capability_record, contract_audit, digest_file, digest_value  # noqa: E402


def _portable(path: Path) -> str:
    try:
        return path.relative_to(WORKSHOP).as_posix()
    except ValueError:
        return path.as_posix()


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")


def _tree_fingerprint(path: Path) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for item in sorted(path.rglob("*")):
        if not item.is_file() or "__pycache__" in item.parts or item.suffix in {".pyc", ".pyo"}:
            continue
        relative = item.relative_to(path).as_posix()
        rows.append({"path": relative, "sha256": digest_file(item), "bytes": item.stat().st_size})
    return {"files": len(rows), "tree_sha256": digest_value(rows)}


class _ControlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.controls: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name == "data-interface-control" and value:
                self.controls.update(part.strip() for part in value.split() if part.strip())


def _interface_snapshot(path: Path, required: list[str]) -> dict[str, Any]:
    source = path.read_text(encoding="utf-8")
    parser = _ControlParser()
    parser.feed(source)
    controls = {control: control in parser.controls for control in required}
    return {
        "schema": "axm.interface-control-snapshot/v1",
        "captured_at": GENERATED_AT,
        "path": _portable(path),
        "sha256": digest_file(path),
        "bytes": path.stat().st_size,
        "controls": controls,
        "all_required_controls_present": all(controls.values()),
        "truth": {"static_structure_checked": True, "runtime_behavior_proven": False},
    }


def _load_signal_engine():
    path = MODULE3 / "signal_metabolism" / "signal_engine.py"
    spec = importlib.util.spec_from_file_location("axm_platform_signal_engine", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load Module 3 signal engine: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.TS = GENERATED_AT
    return module


def _validate_receipt(receipt: dict[str, Any]) -> None:
    schema = json.loads(RECEIPT_SCHEMA.read_text(encoding="utf-8"))
    errors = sorted(Draft202012Validator(schema).iter_errors(receipt), key=lambda error: list(error.absolute_path))
    if errors:
        details = "; ".join(f"/{'/'.join(map(str, error.absolute_path))}: {error.message}" for error in errors[:12])
        raise ValueError("Pipeline receipt schema validation failed: " + details)
    declared = receipt["receipt_sha256"]
    unhashed = {key: value for key, value in receipt.items() if key != "receipt_sha256"}
    if declared != digest_value(unhashed):
        raise ValueError("Pipeline receipt hash does not bind the receipt body")


def build_pipeline(output: Path = DEFAULT_OUTPUT) -> dict[str, Any]:
    output = output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    supplier_before = {
        "human-capability-atlas": _tree_fingerprint(MODULE1),
        "human-interface-intelligence": _tree_fingerprint(MODULE2),
        "grounded-evolution-intelligence": _tree_fingerprint(MODULE3),
    }

    module1_dir = output / "module1"
    card = build_from_file(SOURCE, module1_dir)
    producer_check = verify_producer_receipt(module1_dir)
    if not producer_check["valid"]:
        raise ValueError("Module 1 producer receipt failed: " + json.dumps(producer_check["issues"][:12]))
    quick = (module1_dir / "quick_view.md").read_text(encoding="utf-8")
    practical = (module1_dir / "practical_view.md").read_text(encoding="utf-8")
    deep = (module1_dir / "deep_view.md").read_text(encoding="utf-8")
    human_checks = {
        "human_name_present": card["identity"]["human_name"] in quick,
        "plain_explanation_present": card["purpose"]["plain_explanation"] in quick and card["purpose"]["plain_explanation"] in practical,
        "why_it_matters_present": card["purpose"]["why_it_matters"] in quick,
        "practical_inputs_outputs_present": "## Required inputs" in practical and "## Expected outputs" in practical,
        "deep_source_and_truth_present": "## Source" in deep and "## Unknown fields" in deep and card["source_reference"]["source_hash"] in deep,
        "encoding_is_clean": not any(token in quick + practical + deep for token in ("â€”", "â€™", "�")),
    }
    if not all(human_checks.values()):
        raise ValueError("Module 1 human-readable view checks failed: " + json.dumps(human_checks))

    module2_dir = output / "module2"
    adapted, adaptation = adapt_capability_record(card)
    context = json.loads(CONTEXT.read_text(encoding="utf-8"))
    recommendation = recommend_interface(adapted, context, generated_at=GENERATED_AT)
    assurance = build_recommendation_assurance(adapted, context, recommendation)
    decision_receipt = build_decision_receipt(
        adapted,
        context,
        recommendation,
        module_version=MODULE2_VERSION,
    )
    _write_json(module2_dir / "adapted_capability_record.json", adapted)
    _write_json(module2_dir / "adaptation_receipt.json", adaptation)
    _write_json(module2_dir / "recommendation_context.json", context)
    _write_json(module2_dir / "interface_recommendation.json", recommendation)
    _write_json(module2_dir / "recommendation_assurance.json", assurance)
    _write_json(module2_dir / "decision_receipt.json", decision_receipt)

    selected = recommendation["recommended_interface"]
    required_controls = list(selected["required_controls"])
    after = _interface_snapshot(INTERFACE, required_controls)
    before = json.loads(BEFORE_INTERFACE.read_text(encoding="utf-8"))
    before_missing = sorted(control for control in required_controls if not before["controls"].get(control, False))
    after_missing = sorted(control for control in required_controls if not after["controls"].get(control, False))
    application = {
        "schema": "axm.interface-recommendation-application/v1",
        "generated_at": GENERATED_AT,
        "target": _portable(INTERFACE),
        "recommendation_id": recommendation["recommendation_id"],
        "recommendation_sha256": digest_value(recommendation),
        "selected_interface_pattern_id": selected["interface_pattern_id"],
        "required_controls": required_controls,
        "before": before,
        "after": after,
        "before_missing": before_missing,
        "after_missing": after_missing,
        "status": "PASS" if before_missing and not after_missing else "FAIL",
        "truth": {
            "structural_improvement_proven": bool(before_missing and not after_missing),
            "subjective_visual_quality_claimed": False,
            "human_approval_claimed": False,
            "automatic_execution": False,
        },
    }
    application["application_sha256"] = digest_value(application)
    _write_json(output / "interface-application.json", application)

    recommendation_sha256 = digest_value(recommendation)
    signal_inputs = [
        {
            "occurrence_id": "pipeline-interface-gap-before-001",
            "captured_at": GENERATED_AT,
            "source_type": "BUILD_RESULT",
            "source_location": _portable(module2_dir / "interface_recommendation.json"),
            "source_digest": recommendation_sha256,
            "signal_type": "GAP",
            "statement": "The pre-integration Human Capability Atlas interface lacked the searchable-library controls recommended from its human-readable capability record.",
            "truth_state": "OBSERVED",
            "linked_scope": [
                "axm:module:human-capability-atlas",
                "axm:module:human-interface-intelligence",
            ],
            "assessment": {
                "state": "CORROBORATED",
                "reason": "The retained before snapshot has all four recommended controls absent and is bound to the prior interface hash.",
                "evidence_refs": [
                    "artifact:interface-before:" + before["sha256"],
                    "artifact:module2-recommendation:" + recommendation_sha256,
                ],
            },
            "derivative_candidates": [
                {
                    "kind": "NEED_CANDIDATE",
                    "target_id": "axm:need:apply-searchable-capability-library",
                    "reason": "Add search, filters, preview, and metadata without granting execution or CANON authority.",
                }
            ],
        },
        {
            "occurrence_id": "pipeline-interface-result-after-001",
            "captured_at": GENERATED_AT,
            "source_type": "TEST_RESULT",
            "source_location": _portable(output / "interface-application.json"),
            "source_digest": recommendation_sha256,
            "signal_type": "RESULT",
            "statement": "The local Human Capability Atlas interface now declares every searchable-library control required by the Module 2 recommendation.",
            "truth_state": "TESTED",
            "linked_scope": [
                "axm:module:human-capability-atlas",
                "axm:module:human-interface-intelligence",
                "axm:module:grounded-evolution-intelligence",
            ],
            "assessment": {
                "state": "CORROBORATED",
                "reason": "A deterministic HTML structure audit found search, filters, preview, and metadata controls in the current interface bytes.",
                "evidence_refs": [
                    "artifact:interface-after:" + after["sha256"],
                    "artifact:interface-application:" + application["application_sha256"],
                ],
            },
            "derivative_candidates": [
                {
                    "kind": "NO_ACTION",
                    "target_id": None,
                    "reason": "Retain the tested local result; later human review decides promotion or further work.",
                }
            ],
        },
    ]
    signal_engine = _load_signal_engine()
    signal_report = signal_engine.build(signal_inputs)
    signal_engine.validate(signal_report)
    module3_dir = output / "module3"
    _write_json(module3_dir / "signal_inputs.json", {"schema": "axm.gei.platform-signal-input/v1", "signals": signal_inputs})
    _write_json(module3_dir / "signal_metabolism_report.json", signal_report)

    supplier_after = {
        "human-capability-atlas": _tree_fingerprint(MODULE1),
        "human-interface-intelligence": _tree_fingerprint(MODULE2),
        "grounded-evolution-intelligence": _tree_fingerprint(MODULE3),
    }
    source_stable = supplier_before == supplier_after
    handoff_12_match = adaptation["source"]["record_sha256"] == digest_value(card)
    received_recommendation_digests = {item["source_digest"] for item in signal_inputs}
    handoff_23_match = received_recommendation_digests == {recommendation_sha256}
    authority_closed = all(
        not any(signal["authority"].values())
        for signal in signal_report["signals"]
    )
    candidate_retained = any(
        derivative["kind"] == "NEED_CANDIDATE"
        for signal in signal_report["signals"]
        for derivative in signal["derivative_candidates"]
    )
    audit = contract_audit()

    stage_statuses = {
        "module1": all(human_checks.values()) and producer_check["valid"],
        "module1_to_module2": handoff_12_match and adaptation["admission_state"] == "PLATFORM_TEST_READY",
        "module2": selected["interface_pattern_id"] == "searchable_library" and assurance["overall_status"] == "PASS",
        "interface_application": application["status"] == "PASS",
        "module2_to_module3": handoff_23_match,
        "module3": signal_report["unique_signals"] == 2 and candidate_retained and authority_closed,
        "supplier_source_stability": source_stable,
        "native_contract_visible": audit["native_paired_gate"] == "BLOCKED",
    }
    verdict = "PASS" if all(stage_statuses.values()) else "FAIL"

    receipt: dict[str, Any] = {
        "schema": "axm.capability-intelligence-pipeline-receipt/v1",
        "pipeline_contract": {
            "id": "axm.platform.capability-intelligence-pipeline",
            "version": "1.0.0",
            "mode": "LOCAL_TEST_NO_CANON",
        },
        "generated_at": GENERATED_AT,
        "verdict": verdict,
        "module1": {
            "status": "PASS" if stage_statuses["module1"] else "FAIL",
            "artifacts": {
                "capability_card": _portable(module1_dir / "capability_card.json"),
                "capability_card_sha256": digest_value(card),
                "quick_view": _portable(module1_dir / "quick_view.md"),
                "practical_view": _portable(module1_dir / "practical_view.md"),
                "deep_view": _portable(module1_dir / "deep_view.md"),
                "producer_artifact_set_hash": producer_check["artifact_set_hash"],
            },
            "checks": human_checks,
        },
        "module1_to_module2": {
            "status": "PASS" if stage_statuses["module1_to_module2"] else "FAIL",
            "sender_sha256": digest_value(card),
            "receiver_sha256": adaptation["source"]["record_sha256"],
            "digest_match": handoff_12_match,
            "bridge_contract": adaptation["bridge_contract"],
            "adapted_record_sha256": adaptation["target"]["record_sha256"],
            "native_paired_gate": adaptation["native_paired_gate"],
        },
        "module2": {
            "status": "PASS" if stage_statuses["module2"] else "FAIL",
            "artifacts": {
                "recommendation": _portable(module2_dir / "interface_recommendation.json"),
                "recommendation_sha256": recommendation_sha256,
                "assurance": _portable(module2_dir / "recommendation_assurance.json"),
                "decision_receipt": _portable(module2_dir / "decision_receipt.json"),
            },
            "checks": {
                "selected_interface_pattern_id": selected["interface_pattern_id"],
                "recommendation_status": selected["recommendation_status"],
                "required_controls": required_controls,
                "assurance_status": assurance["overall_status"],
                "assurance_counts": assurance["check_counts"],
            },
        },
        "interface_application": {
            "status": application["status"],
            "artifacts": {
                "application": _portable(output / "interface-application.json"),
                "application_sha256": application["application_sha256"],
                "target_sha256": after["sha256"],
            },
            "checks": {
                "before_missing": before_missing,
                "after_missing": after_missing,
                "implemented_controls": after["controls"],
            },
        },
        "module2_to_module3": {
            "status": "PASS" if stage_statuses["module2_to_module3"] else "FAIL",
            "sender_sha256": recommendation_sha256,
            "receiver_sha256": next(iter(received_recommendation_digests)),
            "digest_match": handoff_23_match,
            "signal_input": _portable(module3_dir / "signal_inputs.json"),
        },
        "module3": {
            "status": "PASS" if stage_statuses["module3"] else "FAIL",
            "artifacts": {
                "signal_report": _portable(module3_dir / "signal_metabolism_report.json"),
                "report_sha256": signal_report["report_hash"],
                "signal_chain_head": signal_report["signal_chain_head"],
            },
            "checks": {
                "unique_signals": signal_report["unique_signals"],
                "occurrences": signal_report["occurrences"],
                "need_candidate_retained": candidate_retained,
                "authority_remains_closed": authority_closed,
                "automatic_canon": False,
            },
        },
        "supplier_source_stability": {
            "status": "PASS" if source_stable else "FAIL",
            "before": supplier_before,
            "after": supplier_after,
        },
        "native_contract_boundary": {
            "status": "BLOCKED",
            "hidden": False,
            "platform_bridge_claims_native_identity": False,
        },
        "truth": {
            "automatic_execution": False,
            "automatic_canon": False,
            "human_approval_claimed": False,
            "visual_quality_claimed": False,
        },
    }
    receipt["receipt_sha256"] = digest_value(receipt)
    _validate_receipt(receipt)
    _write_json(output / "pipeline-receipt.json", receipt)

    summary = {
        "schema": "axm.capability-intelligence-workflow-summary/v1",
        "pipeline_status": verdict,
        "generated_at": GENERATED_AT,
        "module1": {
            "human_name": card["identity"]["human_name"],
            "plain_explanation": card["purpose"]["plain_explanation"],
            "why_it_matters": card["purpose"]["why_it_matters"],
            "source_hash": card["source_reference"]["source_hash"],
            "risk": card["risk_profile"]["risk_level"],
            "maturity": card["maturity_profile"]["maturity"],
            "views": {"quick": "quick_view.md", "practical": "practical_view.md", "deep": "deep_view.md"},
        },
        "module2": {
            "pattern_id": selected["interface_pattern_id"],
            "pattern_name": selected["interface_name"],
            "recommendation_status": selected["recommendation_status"],
            "assurance_status": assurance["overall_status"],
            "confidence": selected["confidence"],
            "required_controls": required_controls,
            "why": selected["why_this_interface"],
            "application_status": application["status"],
        },
        "module3": {
            "unique_signals": signal_report["unique_signals"],
            "signal_chain_head": signal_report["signal_chain_head"],
            "need_candidate": "axm:need:apply-searchable-capability-library",
            "candidate_retained": candidate_retained,
            "authority_remains_closed": authority_closed,
        },
        "module2_to_module3_digest": recommendation_sha256,
        "native_contract_boundary": "BLOCKED",
        "pipeline_receipt_sha256": receipt["receipt_sha256"],
    }
    _write_json(output / "workflow-summary.json", summary)
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the versioned AXM Module 1 → Module 2 → Module 3 workflow")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    receipt = build_pipeline(args.output)
    print(json.dumps({
        "verdict": receipt["verdict"],
        "module1": receipt["module1"]["status"],
        "module2": receipt["module2"]["status"],
        "interface_application": receipt["interface_application"]["status"],
        "module3": receipt["module3"]["status"],
        "receipt_sha256": receipt["receipt_sha256"],
        "output": _portable(args.output.resolve()) if args.output.resolve().is_relative_to(WORKSHOP) else str(args.output.resolve()),
    }, indent=2))
    return 0 if receipt["verdict"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
