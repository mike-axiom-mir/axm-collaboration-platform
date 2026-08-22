from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "independent_verifier_seat_router.py"
SPEC = importlib.util.spec_from_file_location("axm.verify.independent_verifier_seat_router", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
R=MODULE.IndependentVerifierSeatRouter()
def req():return {"required_capabilities":["security"],"excluded_seat_ids":[],"producer_operator_ids":["op1"],"claimant_operator_ids":[],"conflict_domains":["payments"],"independence_required":True}
def seats():return [{"seat_id":"s1","operator_id":"op1","capabilities":["security"],"conflict_domains":[],"available":True,"current_load":0},{"seat_id":"s2","operator_id":"op2","capabilities":["security"],"conflict_domains":[],"available":True,"current_load":2}]
def test_independent_seat_selected():assert R.route(req(),seats())["recommended_seat_id"]=="s2"
def test_producer_rejected():assert R.route(req(),seats())["rejected_seats"][0]["reasons"]==["NOT_INDEPENDENT"]
def test_lowest_load_then_id():
    s=seats()+[{"seat_id":"s0","operator_id":"op3","capabilities":["security"],"conflict_domains":[],"available":True,"current_load":1}];assert R.route(req(),s)["recommended_seat_id"]=="s0"
def test_missing_capability_rejected():
    s=[{"seat_id":"x","operator_id":"o","capabilities":[],"conflict_domains":[],"available":True,"current_load":0}];assert R.route(req(),s)["verdict_state"]=="UNKNOWN"
def test_conflict_domain_rejected():
    s=[{"seat_id":"x","operator_id":"o","capabilities":["security"],"conflict_domains":["payments"],"available":True,"current_load":0}];assert "CONFLICT_DOMAIN" in R.route(req(),s)["rejected_seats"][0]["reasons"]
def test_unavailable_rejected():
    s=seats();s[1]["available"]=False;assert R.route(req(),s)["recommended_seat_id"] is None
def test_explicit_exclusion():
    q=req();q["excluded_seat_ids"]=["s2"];assert R.route(q,seats())["recommended_seat_id"] is None
def test_duplicate_seat_refused():raises(MODULE.VerifierSeatRouterError,lambda:R.route(req(),seats()+[seats()[0]]))
def test_negative_load_refused():
    s=seats();s[1]["current_load"]=-1;raises(MODULE.VerifierSeatRouterError,lambda:R.route(req(),s))
def test_no_assignment_or_relaxation():
    o=R.route(req(),seats());assert o["assignment_applied"] is False and o["independence_relaxed"] is False and o["canon"] is False

def run():
    tests=[v for n,v in sorted(globals().items()) if n.startswith("test_") and callable(v)]
    for t in tests:t()
    print(f"PASS {len(tests)} independent-verifier-seat-router tests")
if __name__=="__main__":run()
