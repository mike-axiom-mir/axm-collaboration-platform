from pathlib import Path
import importlib.util,sys,math
P=Path(__file__).parents[1]/"src"/"roundtrip_inverse_oracle.py";s=importlib.util.spec_from_file_location("roundtrip_inverse_oracle",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
o=m.RoundTripInverseOracle("o")
def test_exact_pass():assert o.evaluate("c",1,1,"exact")["verdict_state"]=="PASS"
def test_exact_type_difference_fails():assert o.evaluate("c",1,True,"exact")["verdict_state"]=="FAIL"
def test_canonical_json_key_order_passes():assert o.evaluate("c",{"a":1,"b":2},{"b":2,"a":1})["verdict_state"]=="PASS"
def test_selected_paths_can_ignore_unselected_change():assert o.evaluate("c",{"keep":1,"drop":2},{"keep":1,"drop":9},"selected_paths",["/keep"])["verdict_state"]=="PASS"
def test_selected_path_missing_fails():assert o.evaluate("c",{"keep":1},{},"selected_paths",["/keep"])["verdict_state"]=="FAIL"
def test_numeric_tolerance_pass():assert o.evaluate("c",1.0,1.01,"numeric_tolerance",absolute_tolerance=.02)["verdict_state"]=="PASS"
def test_numeric_tolerance_fail():assert o.evaluate("c",1.0,1.1,"numeric_tolerance",absolute_tolerance=.02)["verdict_state"]=="FAIL"
def test_invalid_tolerance_refused():raises(m.RoundTripOracleError,lambda:o.evaluate("c",1,1,"numeric_tolerance",absolute_tolerance=-1))
def test_empty_selected_paths_refused():raises(m.RoundTripOracleError,lambda:o.evaluate("c",{}, {},"selected_paths",[]))
def test_operation_ids_preserved_without_execution():
 r=o.evaluate("c",1,1,forward_id="encode",inverse_id="decode");assert r["forward_id"]=="encode" and not r["operations_executed"]
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} roundtrip-inverse-oracle tests")
if __name__=="__main__":run()
