from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "test_gap_blindspot_detector.py"
SPEC = importlib.util.spec_from_file_location("test_gap_blindspot_detector", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Detector=MODULE.TestGapBlindspotDetector()
REQ=[{"requirement_id":"r1","required_evidence":["positive","negative"],"risk_boundaries":["empty"],"needs_native_evidence":True}]
GOOD=[{"requirement_id":"r1","evidence_type":"positive","status":"PASS"},{"requirement_id":"r1","evidence_type":"negative","status":"PASS"},{"requirement_id":"r1","evidence_type":"native","status":"PASS","risk_boundary_id":"empty"}]
def test_complete_passes():assert Detector.analyze(REQ,GOOD,[{"fixture_id":"f","status":"FRESH"}],[])['verdict_state']=="PASS"
def test_untested_detected():assert Detector.analyze(REQ,[])['requirement_gaps'][0]['untested']
def test_missing_kind_detected():assert "negative" in Detector.analyze(REQ,GOOD[:1])['requirement_gaps'][0]['missing_evidence']
def test_native_gap_detected():assert Detector.analyze(REQ,GOOD[:2])['requirement_gaps'][0]['native_evidence_missing']
def test_risk_gap_detected():assert Detector.analyze(REQ,[{**x,"risk_boundary_id":None} for x in GOOD])['requirement_gaps'][0]['uncovered_risk_boundaries']==["empty"]
def test_stale_fixture_detected():assert Detector.analyze(REQ,GOOD,[{"fixture_id":"f","status":"STALE"}])['verdict_state']=="FAIL"
def test_cycle_detected():assert Detector.analyze(REQ,GOOD,[],[{"from_claim":"a","to_claim":"b"},{"from_claim":"b","to_claim":"a"}])['circular_proof_dependencies']
def test_unknown_requirement_refused():raises(MODULE.GapDetectorError,lambda:Detector.analyze(REQ,[{"requirement_id":"x","evidence_type":"positive","status":"PASS"}]))
def test_duplicate_requirement_refused():raises(MODULE.GapDetectorError,lambda:Detector.analyze(REQ+REQ,GOOD))
def test_boundary_truth():
    result=Detector.analyze(REQ,GOOD);assert result['input_completeness_proven'] is False and result['evidence_truth_proven'] is False and result['authority']=="NONE" and result['canon'] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} test-gap-blindspot-detector tests")

if __name__ == "__main__":
    run()
