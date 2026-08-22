from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "requirement_coverage_mapper.py"
SPEC = importlib.util.spec_from_file_location("requirement_coverage_mapper", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Mapper=MODULE.RequirementCoverageMapper();REQ=[{"requirement_id":"r1","required_evidence":["positive","negative"]}]
def ev(i,c,v="PASS"):return {"evidence_id":i,"requirement_id":"r1","category":c,"verdict_state":v}
def test_complete_passes():assert Mapper.map(REQ,[ev("e1","positive"),ev("e2","negative")])["verdict_state"]=="PASS"
def test_missing_fails():assert Mapper.map(REQ,[ev("e1","positive")])["requirements"]["r1"]["categories"]["negative"]["state"]=="MISSING"
def test_failed_evidence_fails():assert Mapper.map(REQ,[ev("e1","positive","FAIL"),ev("e2","negative")])["verdict_state"]=="FAIL"
def test_unknown_stays_unknown():assert Mapper.map(REQ,[ev("e1","positive","UNKNOWN"),ev("e2","negative")])["verdict_state"]=="UNKNOWN"
def test_human_review_pending():
    req=[{"requirement_id":"r1","required_evidence":["human_review"]}]
    assert Mapper.map(req,[ev("e1","human_review","HUMAN_REVIEW")])["verdict_state"]=="UNKNOWN"
def test_human_review_passed():
    req=[{"requirement_id":"r1","required_evidence":["human_review"]}]
    assert Mapper.map(req,[ev("e1","human_review","PASS")])["verdict_state"]=="PASS"
def test_unknown_requirement_refused():raises(MODULE.RequirementCoverageError,lambda:Mapper.map(REQ,[{"evidence_id":"x","requirement_id":"other","category":"positive","verdict_state":"PASS"}]))
def test_duplicate_evidence_refused():raises(MODULE.RequirementCoverageError,lambda:Mapper.map(REQ,[ev("x","positive"),ev("x","negative")]))
def test_bad_category_refused():raises(MODULE.RequirementCoverageError,lambda:Mapper.map([{"requirement_id":"r","required_evidence":["magic"]}],[]))
def test_boundary_truth():
    result=Mapper.map(REQ,[ev("e1","positive"),ev("e2","negative")]);assert result["coverage_does_not_replace_requirement_correctness"] and result["authority"]=="NONE" and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} requirement-coverage-mapper tests")

if __name__ == "__main__":
    run()
