from pathlib import Path
import importlib.util,sys,math
P=Path(__file__).parents[1]/"src"/"reference_implementation_oracle.py";s=importlib.util.spec_from_file_location("reference_implementation_oracle",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def cases(r=1,a=1):return [{"case_id":"c","reference_output":r,"candidate_output":a}]
def test_canonical_json_passes_key_order():assert m.ReferenceImplementationOracle("o").evaluate("ref1","cand1","s",cases({"a":1,"b":2},{"b":2,"a":1}))["verdict_state"]=="PASS"
def test_exact_requires_type_and_value():assert m.ReferenceImplementationOracle("o","exact").evaluate("r","c","s",cases(1,True))["verdict_state"]=="FAIL"
def test_numeric_tolerance_pass():assert m.ReferenceImplementationOracle("o","numeric_tolerance",0.1).evaluate("r","c","s",cases(1.0,1.05))["verdict_state"]=="PASS"
def test_numeric_tolerance_fail():assert m.ReferenceImplementationOracle("o","numeric_tolerance",0.01).evaluate("r","c","s",cases(1.0,1.05))["verdict_state"]=="FAIL"
def test_any_case_failure_fails_aggregate():
 cs=cases();cs.append({"case_id":"d","reference_output":1,"candidate_output":2});assert m.ReferenceImplementationOracle("o").evaluate("r","c","s",cs)["verdict_state"]=="FAIL"
def test_same_identity_refused():raises(m.ReferenceOracleError,lambda:m.ReferenceImplementationOracle("o").evaluate("x","x","s",cases()))
def test_duplicate_case_refused():raises(m.ReferenceOracleError,lambda:m.ReferenceImplementationOracle("o").evaluate("r","c","s",cases()+cases()))
def test_negative_tolerance_refused():raises(m.ReferenceOracleError,lambda:m.ReferenceImplementationOracle("o","numeric_tolerance",-1))
def test_non_numeric_tolerance_case_refused():raises(m.ReferenceOracleError,lambda:m.ReferenceImplementationOracle("o","numeric_tolerance",1).evaluate("r","c","s",cases("1","1")))
def test_reference_trust_not_proven():assert m.ReferenceImplementationOracle("o").evaluate("r","c","s",cases())["reference_trust_proven"] is False
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} reference-implementation-oracle tests")
if __name__=="__main__":run()
