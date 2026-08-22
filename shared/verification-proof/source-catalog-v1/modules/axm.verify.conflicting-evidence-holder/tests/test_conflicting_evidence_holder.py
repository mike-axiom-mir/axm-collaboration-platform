from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"conflicting_evidence_holder.py";s=importlib.util.spec_from_file_location("conflicting_evidence_holder",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def r(i,v,profile="p",scope="s",assertion="a"):
 return {"receipt_id":i,"claim_id":"c","target_profile":profile,"scope_id":scope,"assertion_key":assertion,"verifier_id":"v"+i,"proof_surface":"code","verdict_state":v}
def test_pass_fail_same_context_creates_conflict():
 h=m.ConflictingEvidenceHolder("h");h.add_receipt(r("1","PASS"));x=h.add_receipt(r("2","FAIL"));assert x["conflict_count"]==1 and x["state"]=="CONFLICTED"
def test_same_verdict_no_conflict():
 h=m.ConflictingEvidenceHolder("h");h.add_receipt(r("1","PASS"));assert h.add_receipt(r("2","PASS"))["conflict_count"]==0
def test_different_profile_no_conflict():
 h=m.ConflictingEvidenceHolder("h");h.add_receipt(r("1","PASS","p1"));assert h.add_receipt(r("2","FAIL","p2"))["conflict_count"]==0
def test_different_scope_no_conflict():
 h=m.ConflictingEvidenceHolder("h");h.add_receipt(r("1","PASS",scope="s1"));assert h.add_receipt(r("2","FAIL",scope="s2"))["conflict_count"]==0
def test_unknown_does_not_create_pass_fail_conflict():
 h=m.ConflictingEvidenceHolder("h");h.add_receipt(r("1","PASS"));assert h.add_receipt(r("2","UNKNOWN"))["conflict_count"]==0
def test_review_does_not_resolve_or_delete():
 h=m.ConflictingEvidenceHolder("h");h.add_receipt(r("1","PASS"));x=h.add_receipt(r("2","FAIL"));cid=x["conflicts"][0]["conflict_id"];y=h.attach_review(cid,{"reviewer_id":"human","note":"inspect"});assert y["conflicts"][0]["resolved"] is False and len(y["receipts"])==2
def test_duplicate_receipt_refused():
 h=m.ConflictingEvidenceHolder("h");h.add_receipt(r("1","PASS"));raises(m.ConflictHolderError,lambda:h.add_receipt(r("1","FAIL")))
def test_invalid_verdict_refused():
 h=m.ConflictingEvidenceHolder("h");raises(m.ConflictHolderError,lambda:h.add_receipt(r("1","MAYBE")))
def test_snapshot_is_copy():
 h=m.ConflictingEvidenceHolder("h");x=h.add_receipt(r("1","PASS"));x["receipts"][0]["verdict_state"]="FAIL";assert h.snapshot()["receipts"][0]["verdict_state"]=="PASS"
def test_conflict_id_is_stable():
 h=m.ConflictingEvidenceHolder("h");h.add_receipt(r("1","PASS"));a=h.add_receipt(r("2","FAIL"))["conflicts"][0]["conflict_id"];assert a==h.snapshot()["conflicts"][0]["conflict_id"]
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} conflicting-evidence-holder tests")
if __name__=="__main__":run()
