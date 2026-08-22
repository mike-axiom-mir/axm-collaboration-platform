from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "public_claim_evidence_page.py"
SPEC = importlib.util.spec_from_file_location("axm.verify.public_claim_evidence_page", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
G=MODULE.PublicClaimEvidencePageGenerator()
def claim():return {"claim_id":"c1","statement":"Feature works offline","scope":"version 1 on local LAN","verdict_state":"UNKNOWN","public_safe":True}
def ev(state="PASS",safe=True,eid="r1"):return {"evidence_id":eid,"verdict_state":state,"summary":"reference test passed","source_ref":"proof/r1","public_safe":safe}
def test_page_contains_claim():assert "Feature works offline" in G.generate(claim(),[ev()],[],[])["markdown"]
def test_unknown_claim_remains_unknown():assert G.generate(claim(),[ev()],[],[])["claim_verdict_state"]=="UNKNOWN"
def test_pass_and_fail_separate():
    o=G.generate(claim(),[ev("PASS",True,"p"),ev("FAIL",True,"f")],[],[]);assert "### PASS" in o["markdown"] and "### FAIL" in o["markdown"]
def test_private_evidence_withheld():
    o=G.generate(claim(),[ev("PASS",False)],[],[]);assert o["withheld_evidence_count"]==1 and o["public_evidence"]==[]
def test_limitations_visible():assert "one device" in G.generate(claim(),[],["one device"],[])["markdown"]
def test_steps_numbered():assert "1. Run locally" in G.generate(claim(),[],[],["Run locally"])["markdown"]
def test_non_public_claim_refused():
    x=claim();x["public_safe"]=False;raises(MODULE.PublicEvidencePageError,lambda:G.generate(x,[],[],[]))
def test_invalid_evidence_state_refused():raises(MODULE.PublicEvidencePageError,lambda:G.generate(claim(),[ev("GOOD")],[],[]))
def test_public_summary_required():
    x=ev();x["summary"]="";raises(MODULE.PublicEvidencePageError,lambda:G.generate(claim(),[x],[],[]))
def test_not_published_or_canon():
    o=G.generate(claim(),[],[],[]);assert o["published"] is False and o["authority"]=="NONE" and o["canon"] is False

def run():
    tests=[v for n,v in sorted(globals().items()) if n.startswith("test_") and callable(v)]
    for t in tests:t()
    print(f"PASS {len(tests)} public-claim-evidence-page tests")
if __name__=="__main__":run()
