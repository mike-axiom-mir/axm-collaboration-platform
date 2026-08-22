from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .engine import recommend_interface
from .anchor import evaluate_anchor
from .gate import run_cross_module_gate
from .paired import run_paired_gate
from .handoff import load_handoff
from .trace import build_score_trace
from .audit import audit_handoff
from .context import assess_context
from .dependency_lock import verify_dependency_lock
from .receipts import build_decision_receipt
from .util import dump_json, load_json
from .robustness import probe_recommendation_stability
from .drift import classify_decision_drift
from .signal_lab import run_signal_lab
from .assurance import build_recommendation_assurance
from .registry import PatternRegistry, RegistryValidationError
from .version import MODULE_VERSION


def _validator_module():
    validators_dir = Path(__file__).resolve().parent.parent / "shared-contract" / "validators"
    sys.path.insert(0, str(validators_dir))
    import validate  # type: ignore
    return validate


def cmd_validate(args: argparse.Namespace) -> int:
    validate = _validator_module()
    result = validate.validate_path(Path(args.path), schema_kind=args.kind)
    print(json.dumps(result, indent=2))
    return 0 if result["valid"] else 1


def cmd_recommend(args: argparse.Namespace) -> int:
    payload = load_json(args.path)
    if args.fixture:
        capability = payload["shared_capability_record"]
        context = payload["recommendation_context"]
    else:
        capability = payload["capability"]
        context = payload["context"]
    assessment = assess_context(context)
    if not assessment["valid"]:
        print(json.dumps(assessment, indent=2))
        return 1
    recommendation = recommend_interface(capability, context)
    if args.output:
        dump_json(args.output, recommendation)
    else:
        print(json.dumps(recommendation, indent=2))
    return 0



def cmd_gate(args: argparse.Namespace) -> int:
    batch = load_handoff(args.path)
    report = run_cross_module_gate(
        batch,
        generated_at=args.generated_at,
        strict_provenance=args.strict_provenance,
        include_trace=not args.no_trace,
    )
    if args.output:
        dump_json(args.output, report)
    else:
        print(json.dumps(report, indent=2))
    return 0 if report["overall_status"] in {"PASS", "NOT_RUN"} else 1



def cmd_anchor_gate(args: argparse.Namespace) -> int:
    report = evaluate_anchor(args.path, generated_at=args.generated_at)
    if args.output:
        dump_json(args.output, report)
    else:
        print(json.dumps(report, indent=2))
    return 0 if report.get("strict_merge_status") == "PASS" else 1


def cmd_paired_gate(args: argparse.Namespace) -> int:
    batch = load_handoff(args.path)
    report = run_paired_gate(
        batch,
        args.anchor,
        generated_at=args.generated_at,
        strict_provenance=not args.allow_declared_only_provenance,
        include_trace=not args.no_trace,
    )
    if args.output:
        dump_json(args.output, report)
    else:
        print(json.dumps(report, indent=2))
    return 0 if report.get("overall_status") in {"PASS", "NOT_RUN"} else 1


def cmd_trace(args: argparse.Namespace) -> int:
    payload = load_json(args.path)
    if args.fixture:
        capability = payload["shared_capability_record"]
        context = payload["recommendation_context"]
    else:
        capability = payload["capability"]
        context = payload["context"]
    assessment = assess_context(context)
    if not assessment["valid"]:
        print(json.dumps(assessment, indent=2))
        return 1
    trace = build_score_trace(capability, context, limit=args.limit)
    if args.output:
        dump_json(args.output, trace)
    else:
        print(json.dumps(trace, indent=2))
    return 0



def cmd_context_check(args: argparse.Namespace) -> int:
    payload = load_json(args.path)
    context = payload["recommendation_context"] if args.fixture else payload.get("context", payload)
    report = assess_context(context)
    if args.output:
        dump_json(args.output, report)
    else:
        print(json.dumps(report, indent=2))
    return 0 if report["valid"] else 1


def cmd_verify_lock(args: argparse.Namespace) -> int:
    report = verify_dependency_lock(args.lock)
    if args.output:
        dump_json(args.output, report)
    else:
        print(json.dumps(report, indent=2))
    return 0 if report["overall_status"] == "PASS" else 1


def cmd_receipt(args: argparse.Namespace) -> int:
    payload = load_json(args.path)
    if args.fixture:
        capability = payload["shared_capability_record"]
        context = payload["recommendation_context"]
    else:
        capability = payload["capability"]
        context = payload["context"]
    assessment = assess_context(context)
    if not assessment["valid"]:
        print(json.dumps(assessment, indent=2))
        return 1
    recommendation = recommend_interface(capability, context, generated_at=args.generated_at)
    receipt = build_decision_receipt(capability, context, recommendation, module_version=MODULE_VERSION)
    if args.output:
        dump_json(args.output, receipt)
    else:
        print(json.dumps(receipt, indent=2))
    return 0


def cmd_intake_audit(args: argparse.Namespace) -> int:
    batch = load_handoff(args.path)
    report = audit_handoff(
        batch,
        anchor_path=args.anchor,
        generated_at=args.generated_at,
        strict_provenance=args.strict_provenance,
    )
    if args.output:
        dump_json(args.output, report)
    else:
        print(json.dumps(report, indent=2))
    gate = report.get("cross_module_gate")
    if isinstance(gate, dict):
        return 0 if gate.get("overall_status") in {"PASS", "NOT_RUN"} else 1
    boundary = report.get("paired_boundary")
    return 0 if isinstance(boundary, dict) and boundary.get("overall_status") in {"PASS", "NOT_RUN"} else 1


def cmd_robustness(args: argparse.Namespace) -> int:
    payload = load_json(args.path)
    if args.fixture:
        capability = payload["shared_capability_record"]
        context = payload["recommendation_context"]
    else:
        capability = payload["capability"]
        context = payload["context"]
    report = probe_recommendation_stability(capability, context)
    if args.output:
        dump_json(args.output, report)
    else:
        print(json.dumps(report, indent=2))
    return 0


def cmd_drift(args: argparse.Namespace) -> int:
    before = load_json(args.before)
    after = load_json(args.after)
    report = classify_decision_drift(before, after)
    if args.output:
        dump_json(args.output, report)
    else:
        print(json.dumps(report, indent=2))
    return 0


def cmd_signal_lab(args: argparse.Namespace) -> int:
    batch = load_handoff(args.path)
    report = run_signal_lab(
        batch,
        anchor_path=args.anchor,
        generated_at=args.generated_at,
        strict_provenance=args.strict_provenance,
    )
    if args.output:
        dump_json(args.output, report)
    else:
        print(json.dumps(report, indent=2))
    # Shadow lab itself completes even when the authoritative gate blocks; the block is retained as signal.
    return 0


def cmd_assurance(args: argparse.Namespace) -> int:
    payload = load_json(args.path)
    if args.fixture:
        capability = payload["shared_capability_record"]
        context = payload["recommendation_context"]
    else:
        capability = payload["capability"]
        context = payload["context"]
    recommendation = recommend_interface(capability, context, generated_at=args.generated_at)
    report = build_recommendation_assurance(capability, context, recommendation)
    if args.output:
        dump_json(args.output, report)
    else:
        print(json.dumps(report, indent=2))
    return 0 if report["overall_status"] in {"PASS", "REVIEW", "NOT_APPLICABLE"} else 1


def cmd_registry_check(args: argparse.Namespace) -> int:
    try:
        registry = PatternRegistry(load_json(args.path)) if args.path else PatternRegistry()
    except RegistryValidationError as exc:
        report = {"valid": False, "errors": [{"path": "/", "message": str(exc)}], "warnings": []}
        if args.output:
            dump_json(args.output, report)
        else:
            print(json.dumps(report, indent=2))
        return 1
    report = {
        **registry.validation_report,
        "registry_fingerprint": registry.fingerprint,
    }
    if args.output:
        dump_json(args.output, report)
    else:
        print(json.dumps(report, indent=2))
    return 0

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="axm-hii")
    sub = parser.add_subparsers(dest="command", required=True)
    validate = sub.add_parser("validate", help="Validate a capability or recommendation JSON file.")
    validate.add_argument("path")
    validate.add_argument("--kind", choices=["auto", "capability", "recommendation"], default="auto")
    validate.set_defaults(func=cmd_validate)
    recommend = sub.add_parser("recommend", help="Generate a deterministic interface recommendation.")
    recommend.add_argument("path")
    recommend.add_argument("--fixture", action="store_true")
    recommend.add_argument("--output")
    recommend.set_defaults(func=cmd_recommend)

    gate = sub.add_parser("gate", help="Run the Atlas-to-Interface cross-module merge gate.")
    gate.add_argument("path")
    gate.add_argument("--output")
    gate.add_argument("--generated-at")
    gate.add_argument("--strict-provenance", action="store_true")
    gate.add_argument("--no-trace", action="store_true")
    gate.set_defaults(func=cmd_gate)

    anchor_gate = sub.add_parser("anchor-gate", help="Verify a Module One stable handoff anchor without executing its code.")
    anchor_gate.add_argument("path")
    anchor_gate.add_argument("--output")
    anchor_gate.add_argument("--generated-at")
    anchor_gate.set_defaults(func=cmd_anchor_gate)

    paired_gate = sub.add_parser("paired-gate", help="Require a passing stable anchor before consuming an Atlas handoff batch.")
    paired_gate.add_argument("path", help="Atlas handoff batch JSON.")
    paired_gate.add_argument("--anchor", required=True, help="Module One stable anchor ZIP.")
    paired_gate.add_argument("--output")
    paired_gate.add_argument("--generated-at")
    paired_gate.add_argument("--allow-declared-only-provenance", action="store_true")
    paired_gate.add_argument("--no-trace", action="store_true")
    paired_gate.set_defaults(func=cmd_paired_gate)

    trace = sub.add_parser("trace", help="Show deterministic pattern scoring and reasons.")
    trace.add_argument("path")
    trace.add_argument("--fixture", action="store_true")
    trace.add_argument("--limit", type=int)
    trace.add_argument("--output")
    trace.set_defaults(func=cmd_trace)

    context_check = sub.add_parser("context-check", help="Validate recommendation context without filling missing values.")
    context_check.add_argument("path")
    context_check.add_argument("--fixture", action="store_true")
    context_check.add_argument("--output")
    context_check.set_defaults(func=cmd_context_check)

    lock = sub.add_parser("verify-lock", help="Verify exact shared-contract and registry dependency fingerprints.")
    lock.add_argument("--lock", default=str(Path(__file__).resolve().parent.parent / "integration" / "dependency_lock.json"))
    lock.add_argument("--output")
    lock.set_defaults(func=cmd_verify_lock)

    receipt = sub.add_parser("receipt", help="Generate a reproducible decision receipt separate from the shared recommendation.")
    receipt.add_argument("path")
    receipt.add_argument("--fixture", action="store_true")
    receipt.add_argument("--generated-at")
    receipt.add_argument("--output")
    receipt.set_defaults(func=cmd_receipt)

    audit = sub.add_parser("intake-audit", help="Run intake gate plus reproducibility, health, and advisory evolution outputs.")
    audit.add_argument("path")
    audit.add_argument("--anchor")
    audit.add_argument("--generated-at")
    audit.add_argument("--strict-provenance", action="store_true")
    audit.add_argument("--output")
    audit.set_defaults(func=cmd_intake_audit)

    robustness = sub.add_parser("robustness", help="Run bounded synthetic counterfactual probes in shadow mode.")
    robustness.add_argument("path")
    robustness.add_argument("--fixture", action="store_true")
    robustness.add_argument("--output")
    robustness.set_defaults(func=cmd_robustness)

    drift = sub.add_parser("decision-drift", help="Classify what changed between two decision receipts.")
    drift.add_argument("before")
    drift.add_argument("after")
    drift.add_argument("--output")
    drift.set_defaults(func=cmd_drift)

    signal_lab = sub.add_parser("signal-lab", help="Run authoritative intake plus bounded shadow analysis; retain blocked input as signal.")
    signal_lab.add_argument("path")
    signal_lab.add_argument("--anchor")
    signal_lab.add_argument("--generated-at")
    signal_lab.add_argument("--strict-provenance", action="store_true")
    signal_lab.add_argument("--output")
    signal_lab.set_defaults(func=cmd_signal_lab)

    assurance = sub.add_parser("assurance", help="Cross-check a recommendation for implementation readiness without changing it.")
    assurance.add_argument("path")
    assurance.add_argument("--fixture", action="store_true")
    assurance.add_argument("--generated-at")
    assurance.add_argument("--output")
    assurance.set_defaults(func=cmd_assurance)

    registry_check = sub.add_parser("registry-check", help="Validate and fingerprint an interface-pattern registry.")
    registry_check.add_argument("path", nargs="?")
    registry_check.add_argument("--output")
    registry_check.set_defaults(func=cmd_registry_check)
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    raise SystemExit(args.func(args))


if __name__ == "__main__":
    main()
