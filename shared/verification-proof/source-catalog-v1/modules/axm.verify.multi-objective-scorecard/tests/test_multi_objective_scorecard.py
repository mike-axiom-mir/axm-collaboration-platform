from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'multi_objective_scorecard.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.multi_objective_scorecard', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

S=MODULE.MultiObjectiveEvidenceScorecard()
def dim(state="PASS",value=1):return {"verdict_state":state,"value":value,"unit":"u","evidence_ids":["r1"],"limitations":["scope"]}
def full():return {name:dim() for name in MODULE.DIMENSIONS}
def test_full_scorecard_complete():assert S.build(full())["complete"] is True
def test_missing_dimension_not_run():assert S.build({"correctness":dim()})["dimensions"][1]["verdict_state"]=="NOT_RUN"
def test_unresolved_preserved():assert "safety" in S.build({"safety":dim("UNKNOWN")})["unresolved_dimensions"]
def test_fail_not_averaged():assert next(x for x in S.build({"safety":dim("FAIL")})["dimensions"] if x["dimension"]=="safety")["verdict_state"]=="FAIL"
def test_overall_score_absent():assert S.build(full())["overall_score"] is None
def test_overall_key_refused():raises(MODULE.MultiObjectiveScorecardError,lambda:S.build({"overall_score":{}}))
def test_unknown_dimension_refused():raises(MODULE.MultiObjectiveScorecardError,lambda:S.build({"speed":dim()}))
def test_invalid_state_refused():raises(MODULE.MultiObjectiveScorecardError,lambda:S.build({"correctness":dim("GOOD")}))
def test_evidence_list_validated():raises(MODULE.MultiObjectiveScorecardError,lambda:S.build({"correctness":{"verdict_state":"PASS","evidence_ids":[1],"limitations":[]}}))
def test_no_ranking_or_canon():
    out=S.build(full());assert out["overall_verdict"]=="NOT_COMPUTED" and out["ranking_produced"] is False and out["canon"] is False

def run():
    tests=[value for name,value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:test()
    print(f"PASS {len(tests)} multi-objective-scorecard tests")
if __name__=="__main__":run()
