from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"constraint_proof_adapter.py";s=importlib.util.spec_from_file_location("constraint_proof_adapter",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
A=m.ConstraintProofAdapter()
def obl(expected="UNSAT",**k):return A.create_obligation(obligation_id="o",logic="QF_LIA",constraints=["x>0"],expected=expected,solver_name="s",solver_version="1",**k)
def test_obligation_sealed():assert len(obl()["obligation_sha256"])==64
def test_unsat_expected_passes():assert A.normalize_result(obl(),{"status":"UNSAT","unsat_core":["x>0"]})["verdict_state"]=="PASS"
def test_sat_mismatch_fails():assert A.normalize_result(obl(),{"status":"SAT","model":{"x":1}})["verdict_state"]=="FAIL"
def test_sat_expected_passes():assert A.normalize_result(obl("SAT"),{"status":"SAT","model":{"x":1}})["verdict_state"]=="PASS"
def test_unknown_preserved():assert A.normalize_result(obl(),{"status":"UNKNOWN"})["verdict_state"]=="UNKNOWN"
def test_error_preserved_unknown():assert A.normalize_result(obl(),{"status":"ERROR"})["verdict_state"]=="UNKNOWN"
def test_required_model_refused():raises(m.ConstraintAdapterError,lambda:A.normalize_result(obl("SAT",require_model=True),{"status":"SAT"}))
def test_empty_constraints_refused():raises(m.ConstraintAdapterError,lambda:A.create_obligation(obligation_id="o",logic="x",constraints=[],expected="SAT",solver_name="s",solver_version="1"))
def test_invalid_expectation_refused():raises(m.ConstraintAdapterError,lambda:A.create_obligation(obligation_id="o",logic="x",constraints=["a"],expected="MAYBE",solver_name="s",solver_version="1"))
def test_boundary_caller_supplied_no_authority():
 r=A.normalize_result(obl(),{"status":"UNSAT"});assert r["result_source"]=="CALLER_SUPPLIED" and r["authority"]=="NONE" and r["canon"] is False

def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} constraint-proof-adapter tests")
if __name__=="__main__":run()
