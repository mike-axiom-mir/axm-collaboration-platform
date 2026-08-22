from pathlib import Path
import importlib.util, sys
P=Path(__file__).parents[1]/"src"/"evidence_sufficiency_policy.py"; s=importlib.util.spec_from_file_location("evidence_sufficiency_policy",P); m=importlib.util.module_from_spec(s); sys.modules[s.name]=m; s.loader.exec_module(m)
def raises(e,f):
    try:f()
    except e:return
    raise AssertionError

def rec(i="r1",surface="code",ind="INDEPENDENT",fresh="FRESH",rel="RELEVANT",native="FIT",verdict="PASS"):
    return {"receipt_id":i,"claim_id":"c1","verdict_state":verdict,"freshness_state":fresh,"relevance_state":rel,"native_fit_state":native,"proof_surface":surface,"verifier_id":"v"+i,"independence_state":ind}

def test_sufficient_when_all_thresholds_met():
    p=m.EvidenceSufficiencyPolicy("p",2,["code","visual"],2); r=p.evaluate("c1",[rec("1","code"),rec("2","visual")]); assert r["sufficiency_state"]=="SUFFICIENT" and not r["sufficient_means_pass"]
def test_missing_surface_insufficient():
    assert m.EvidenceSufficiencyPolicy("p",1,["visual"]).evaluate("c1",[rec()])["sufficiency_state"]=="INSUFFICIENT"
def test_unknown_can_make_state_unknown():
    p=m.EvidenceSufficiencyPolicy("p",1,["code"]); assert p.evaluate("c1",[rec(fresh="UNKNOWN")])["sufficiency_state"]=="UNKNOWN"
def test_stale_is_excluded():
    r=m.EvidenceSufficiencyPolicy("p").evaluate("c1",[rec(fresh="STALE")]); assert r["sufficiency_state"]=="INSUFFICIENT" and r["excluded_receipts"]
def test_native_fit_can_be_required():
    p=m.EvidenceSufficiencyPolicy("p",require_native_fit=True); assert p.evaluate("c1",[rec(native="NO_FIT")])["sufficiency_state"]=="INSUFFICIENT"
def test_independence_is_explicit():
    p=m.EvidenceSufficiencyPolicy("p",min_independent_verifiers=1); assert p.evaluate("c1",[rec(ind="UNKNOWN")])["sufficiency_state"]=="INSUFFICIENT"
def test_claim_mismatch_excluded():
    x=rec(); x["claim_id"]="other"; assert m.EvidenceSufficiencyPolicy("p").evaluate("c1",[x])["excluded_receipts"][0]["reasons"]==["CLAIM_MISMATCH"]
def test_duplicate_receipt_refused():
    raises(m.EvidenceSufficiencyError,lambda:m.EvidenceSufficiencyPolicy("p").evaluate("c1",[rec(),rec()]))
def test_invalid_threshold_refused():
    raises(m.EvidenceSufficiencyError,lambda:m.EvidenceSufficiencyPolicy("p",-1))
def test_verdict_filter_preserved():
    p=m.EvidenceSufficiencyPolicy("p",accepted_verdict_states=["HUMAN_REVIEW"]); assert p.evaluate("c1",[rec(verdict="PASS")])["sufficiency_state"]=="INSUFFICIENT"
def run():
    t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} evidence-sufficiency-policy tests")
if __name__=="__main__":run()
