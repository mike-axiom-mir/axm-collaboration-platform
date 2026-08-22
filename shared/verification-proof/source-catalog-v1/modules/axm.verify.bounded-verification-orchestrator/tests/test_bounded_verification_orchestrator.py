from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "bounded_verification_orchestrator.py"
SPEC = importlib.util.spec_from_file_location("axm.verify.bounded_verification_orchestrator", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")


O = MODULE.BoundedVerificationOrchestrator()


def claims():
    return [{"claim_id": "c1", "claim_type": "visual", "subject_ref": "artifact:a", "scope_ref": "scope:v1"}]


def profile(independent=False, human=False):
    return {
        "profile_id": "p1",
        "requirements": [{
            "requirement_id": "r1",
            "claim_type": "visual",
            "proof_surface": "native_visual",
            "verifier_id": "axm.verify.visual-state-proof-binder",
            "independent_verifier_required": independent,
            "human_review_required": human,
        }],
    }


def receipt(state="PASS", fresh=True, independent=True):
    return {
        "receipt_id": "e1",
        "claim_id": "c1",
        "proof_surface": "native_visual",
        "verifier_id": "axm.verify.visual-state-proof-binder",
        "verdict_state": state,
        "evidence_ref": "proof:e1",
        "fresh": fresh,
        "independent": independent,
    }


def release():
    return {"artifact_identity": "sha256:a", "rollback_ref": "rollback:r1", "proof_export_ref": "pack:p1"}


def test_complete_route_is_ready_for_external_gate():
    out = O.coordinate(claims(), profile(), ["axm.verify.visual-state-proof-binder"], [receipt()], release_context=release())
    assert out["claim_results"][0]["coordination_readiness"] == "PASS"
    assert out["external_gate_state"] == "READY_FOR_EXTERNAL_GATE"


def test_missing_organ_blocks_as_unknown():
    out = O.coordinate(claims(), profile(), [], [], release_context=release())
    assert out["claim_results"][0]["coordination_readiness"] == "UNKNOWN"
    assert out["claim_results"][0]["missing_organs"] == ["axm.verify.visual-state-proof-binder"]


def test_fail_receipt_remains_fail():
    out = O.coordinate(claims(), profile(), ["axm.verify.visual-state-proof-binder"], [receipt("FAIL")])
    assert out["claim_results"][0]["coordination_readiness"] == "FAIL"


def test_stale_receipt_remains_stale():
    out = O.coordinate(claims(), profile(), ["axm.verify.visual-state-proof-binder"], [receipt("STALE", False)])
    assert out["claim_results"][0]["coordination_readiness"] == "STALE"


def test_unresolved_conflict_is_held():
    conflict = {"conflict_id": "x1", "claim_id": "c1", "resolved": False}
    out = O.coordinate(claims(), profile(), ["axm.verify.visual-state-proof-binder"], [receipt()], [conflict])
    assert out["claim_results"][0]["coordination_readiness"] == "CONFLICTED"


def test_independent_requirement_is_enforced():
    out = O.coordinate(claims(), profile(independent=True), ["axm.verify.visual-state-proof-binder"], [receipt(independent=False)])
    assert out["claim_results"][0]["coordination_readiness"] == "UNKNOWN"


def test_human_review_requirement_is_not_silently_satisfied():
    out = O.coordinate(claims(), profile(human=True), ["axm.verify.visual-state-proof-binder"], [receipt()])
    assert out["claim_results"][0]["coordination_readiness"] == "HUMAN_REVIEW"


def test_authorized_human_pass_satisfies_declared_review_seam():
    review = {"review_id": "h1", "claim_id": "c1", "verdict_state": "PASS", "review_ref": "review:h1", "within_authority": True}
    out = O.coordinate(claims(), profile(human=True), ["axm.verify.visual-state-proof-binder"], [receipt()], human_reviews=[review], release_context=release())
    assert out["claim_results"][0]["coordination_readiness"] == "PASS"


def test_release_context_is_required_for_external_gate_readiness():
    out = O.coordinate(claims(), profile(), ["axm.verify.visual-state-proof-binder"], [receipt()])
    assert out["external_gate_state"] == "BLOCKED"


def test_unknown_receipt_state_is_refused():
    bad = receipt("MAYBE")
    raises(MODULE.VerificationOrchestratorError, lambda: O.coordinate(claims(), profile(), ["axm.verify.visual-state-proof-binder"], [bad]))


def test_duplicate_claim_ids_are_refused():
    duplicate = claims() + claims()
    raises(MODULE.VerificationOrchestratorError, lambda: O.coordinate(duplicate, profile(), []))


def test_orchestrator_never_executes_approves_publishes_or_promotes_canon():
    out = O.coordinate(claims(), profile(), ["axm.verify.visual-state-proof-binder"], [receipt()], release_context=release())
    assert out["tests_executed"] is False
    assert out["receipts_created"] is False
    assert out["approved"] is False
    assert out["published"] is False
    assert out["canon"] is False
    assert out["authority"] == "NONE"


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} bounded-verification-orchestrator tests")


if __name__ == "__main__":
    run()
