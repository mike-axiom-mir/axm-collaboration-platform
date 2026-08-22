from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "verification_profile_registry.py"
SPEC = importlib.util.spec_from_file_location("axm.verify.verification_profile_registry", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
R=MODULE.VerificationProfileRegistry()
def profile(pid="p1"):return {"profile_id":pid,"target_type":"local-app","required_claims":["correctness","privacy"],"specialist_verifiers":["code","human"],"tolerances":{"latency_ms":100},"evidence_surfaces":["test_receipt","native_screen"],"release_thresholds":{"correctness":["PASS"],"privacy":["PASS","HUMAN_REVIEW"]}}
def test_register_and_get():assert R.register(profile())["profile_id"]=="p1" and R.get("p1")["target_type"]=="local-app"
def test_duplicate_refused():
    r=MODULE.VerificationProfileRegistry();r.register(profile("dup"));raises(MODULE.VerificationProfileError,lambda:r.register(profile("dup")))
def test_digest_deterministic():
    a=MODULE.VerificationProfileRegistry().register(profile("x"));b=MODULE.VerificationProfileRegistry().register(profile("x"));assert a["profile_digest"]==b["profile_digest"]
def test_negative_tolerance_refused():
    x=profile("n");x["tolerances"]={"latency":-1};raises(MODULE.VerificationProfileError,lambda:MODULE.VerificationProfileRegistry().register(x))
def test_unknown_state_refused():
    x=profile("u");x["release_thresholds"]={"correctness":["GOOD"]};raises(MODULE.VerificationProfileError,lambda:MODULE.VerificationProfileRegistry().register(x))
def test_undeclared_claim_threshold_refused():
    x=profile("c");x["release_thresholds"]={"safety":["PASS"]};raises(MODULE.VerificationProfileError,lambda:MODULE.VerificationProfileRegistry().register(x))
def test_universal_score_refused():
    x=profile("s");x["release_thresholds"]={"overall":["PASS"]};raises(MODULE.VerificationProfileError,lambda:MODULE.VerificationProfileRegistry().register(x))
def test_duplicate_verifiers_refused():
    x=profile("d");x["specialist_verifiers"]=["code","code"];raises(MODULE.VerificationProfileError,lambda:MODULE.VerificationProfileRegistry().register(x))
def test_match_is_target_specific():
    r=MODULE.VerificationProfileRegistry();r.register(profile("a"));x=profile("b");x["target_type"]="game";r.register(x);assert [p["profile_id"] for p in r.match("local-app")]==["a"]
def test_no_approval_or_canon():
    o=MODULE.VerificationProfileRegistry().register(profile("z"));assert o["approval_authority"] is False and o["canon"] is False

def run():
    tests=[v for n,v in sorted(globals().items()) if n.startswith("test_") and callable(v)]
    for t in tests:t()
    print(f"PASS {len(tests)} verification-profile-registry tests")
if __name__=="__main__":run()
