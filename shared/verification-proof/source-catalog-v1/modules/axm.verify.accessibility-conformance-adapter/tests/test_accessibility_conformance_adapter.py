from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "accessibility_conformance_adapter.py"
SPEC = importlib.util.spec_from_file_location("accessibility_conformance_adapter", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Adapter=MODULE.AccessibilityConformanceAdapter();C=[{"claim_id":"c","required_evidence":["machine","keyboard","human"]}];E=[{"claim_id":"c","evidence_type":"machine","status":"PASS"},{"claim_id":"c","evidence_type":"keyboard","status":"PASS"},{"claim_id":"c","evidence_type":"human","status":"PASS"}]
def test_all_pass():assert Adapter.evaluate(C,E)['verdict_state']=="PASS"
def test_human_pending():assert Adapter.evaluate(C,E[:2])['verdict_state']=="HUMAN_REVIEW"
def test_machine_missing_unknown():assert Adapter.evaluate(C,E[1:])['verdict_state']=="UNKNOWN"
def test_failure_fails():assert Adapter.evaluate(C,[{**E[0],"status":"FAIL"},*E[1:]])['verdict_state']=="FAIL"
def test_stale_unknown():assert Adapter.evaluate(C,[{**E[0],"status":"STALE"},*E[1:]])['verdict_state']=="UNKNOWN"
def test_seats_preserved():assert set(Adapter.evaluate(C,E)['claims'][0]['evidence_seats'])=={"machine","keyboard","human"}
def test_unknown_claim_refused():raises(MODULE.AccessibilityAdapterError,lambda:Adapter.evaluate(C,[{"claim_id":"x","evidence_type":"machine","status":"PASS"}]))
def test_duplicate_seat_refused():raises(MODULE.AccessibilityAdapterError,lambda:Adapter.evaluate(C,E+[E[0]]))
def test_bad_type_refused():raises(MODULE.AccessibilityAdapterError,lambda:Adapter.evaluate([{"claim_id":"c","required_evidence":["magic"]}],[]))
def test_boundary_truth():
    result=Adapter.evaluate(C,E);assert result['not_a_certification'] and result['evidence_truth_reverified'] is False and result['human_evidence_replaced'] is False and result['canon'] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} accessibility-conformance-adapter tests")

if __name__ == "__main__":
    run()
