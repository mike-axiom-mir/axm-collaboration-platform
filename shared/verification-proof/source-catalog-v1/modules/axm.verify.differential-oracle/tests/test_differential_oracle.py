from pathlib import Path
import importlib.util,sys,math
P=Path(__file__).parents[1]/"src"/"differential_oracle.py";s=importlib.util.spec_from_file_location("differential_oracle",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def case(outputs,id="c"):return [{"case_id":id,"outputs":outputs}]
def test_agreement():assert m.DifferentialOracle("o").evaluate(["a","b"],case({"a":{"x":1},"b":{"x":1}}))["state"]=="AGREEMENT"
def test_key_order_agrees():assert m.DifferentialOracle("o").evaluate(["a","b"],case({"a":{"x":1,"y":2},"b":{"y":2,"x":1}}))["state"]=="AGREEMENT"
def test_disagreement():assert m.DifferentialOracle("o").evaluate(["a","b"],case({"a":1,"b":2}))["state"]=="DISAGREEMENT"
def test_missing_is_unknown():assert m.DifferentialOracle("o").evaluate(["a","b"],case({"a":1}))["state"]=="UNKNOWN"
def test_disagreement_dominates_aggregate():
 cs=case({"a":1,"b":1},"c1")+case({"a":1,"b":2},"c2");assert m.DifferentialOracle("o").evaluate(["a","b"],cs)["state"]=="DISAGREEMENT"
def test_no_winner_selected():assert m.DifferentialOracle("o").evaluate(["a","b","c"],case({"a":1,"b":1,"c":2}))["winner"] is None
def test_fewer_than_two_refused():raises(m.DifferentialOracleError,lambda:m.DifferentialOracle("o").evaluate(["a"],case({"a":1})))
def test_duplicate_implementation_refused():raises(m.DifferentialOracleError,lambda:m.DifferentialOracle("o").evaluate(["a","a"],case({"a":1})))
def test_duplicate_case_refused():raises(m.DifferentialOracleError,lambda:m.DifferentialOracle("o").evaluate(["a","b"],case({"a":1,"b":1})*2))
def test_nan_refused():raises(m.DifferentialOracleError,lambda:m.DifferentialOracle("o").evaluate(["a","b"],case({"a":math.nan,"b":math.nan})))
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} differential-oracle tests")
if __name__=="__main__":run()
