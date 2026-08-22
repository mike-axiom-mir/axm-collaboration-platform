from pathlib import Path
import importlib.util
import sys

MODULE_PATH = Path(__file__).parents[1] / "src" / "acceptance_criterion_compiler.py"
spec = importlib.util.spec_from_file_location("acceptance_criterion_compiler", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)

def expect_raises(exc_type, fn):
    try:
        fn()
    except exc_type:
        return
    raise AssertionError(f"expected {exc_type.__name__}")

def goal():
    return {"goal_id": "g1", "claim_id": "c1", "human_goal": "Keep the same player seat after reconnect."}

def criterion(kind="MACHINE", cid="k1"):
    item = {
        "criterion_id": cid,
        "statement": "Seat identity remains unchanged.",
        "check_type": kind,
        "proof_surface": "interaction-replay",
        "tolerance": {"changed_seats": 0},
        "evidence_requirements": ["replay receipt"],
        "refusal_conditions": ["seat changed"],
    }
    if kind in {"MACHINE", "COMPOSITE"}:
        item["machine_check"] = {"operation": "compare_seat_id"}
    if kind in {"HUMAN", "COMPOSITE"}:
        item["human_check"] = {"question": "Was the same seat restored?"}
    return item

def test_machine_contract_compiles():
    result = mod.compile_acceptance_contract(goal(), [criterion()])
    assert result["criterion_count"] == 1
    assert result["execution_state"] == "NOT_RUN"
    assert result["decision"] is None

def test_human_goal_preserved():
    g = goal()
    result = mod.compile_acceptance_contract(g, [criterion()])
    assert result["human_goal"] == g["human_goal"]
    assert result["human_goal_rewritten"] is False

def test_composite_requires_both_checks():
    bad = criterion("COMPOSITE")
    bad.pop("human_check")
    expect_raises(mod.AcceptanceCriterionError, lambda: mod.compile_acceptance_contract(goal(), [bad]))

def test_human_check_required():
    bad = criterion("HUMAN")
    bad.pop("human_check")
    expect_raises(mod.AcceptanceCriterionError, lambda: mod.compile_acceptance_contract(goal(), [bad]))

def test_machine_check_required():
    bad = criterion("MACHINE")
    bad.pop("machine_check")
    expect_raises(mod.AcceptanceCriterionError, lambda: mod.compile_acceptance_contract(goal(), [bad]))

def test_freeform_only_refused():
    expect_raises(mod.AcceptanceCriterionError, lambda: mod.compile_acceptance_contract(goal(), []))

def test_duplicate_criterion_id_refused():
    expect_raises(mod.AcceptanceCriterionError, lambda: mod.compile_acceptance_contract(goal(), [criterion(cid="x"), criterion(cid="x")]))

def test_empty_evidence_refused():
    bad = criterion()
    bad["evidence_requirements"] = []
    expect_raises(mod.AcceptanceCriterionError, lambda: mod.compile_acceptance_contract(goal(), [bad]))

def test_deterministic_sort_and_id():
    a = mod.compile_acceptance_contract(goal(), [criterion(cid="b"), criterion(cid="a")])
    b = mod.compile_acceptance_contract(goal(), [criterion(cid="a"), criterion(cid="b")])
    assert [x["criterion_id"] for x in a["criteria"]] == ["a", "b"]
    assert a["contract_id"] == b["contract_id"]

def test_no_approval_authority():
    result = mod.compile_acceptance_contract(goal(), [criterion()])
    assert result["authority"] == "NONE"
    assert result["canon"] is False

def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
    print(f"PASS {len(tests)} acceptance-criterion-compiler tests")

if __name__ == "__main__":
    run()
