from pathlib import Path
import importlib.util,sys,base64,math
P=Path(__file__).parents[1]/"src"/"exact_output_oracle.py";s=importlib.util.spec_from_file_location("exact_output_oracle",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def test_scalar_exact_pass():assert m.ExactOutputOracle("o","scalar").evaluate("c",1,1)["verdict_state"]=="PASS"
def test_scalar_type_difference_fails():assert m.ExactOutputOracle("o","scalar").evaluate("c",1,True)["verdict_state"]=="FAIL"
def test_text_whitespace_difference_fails():assert m.ExactOutputOracle("o","text").evaluate("c","a ","a")["verdict_state"]=="FAIL"
def test_json_key_order_passes():assert m.ExactOutputOracle("o","canonical_json").evaluate("c",{"a":1,"b":2},{"b":2,"a":1})["verdict_state"]=="PASS"
def test_json_list_order_fails():assert m.ExactOutputOracle("o","canonical_json").evaluate("c",[1,2],[2,1])["verdict_state"]=="FAIL"
def test_bytes_base64_pass():
 x=base64.b64encode(b"abc").decode();assert m.ExactOutputOracle("o","bytes_base64").evaluate("c",x,x)["exact_match"]
def test_invalid_base64_refused():raises(m.ExactOutputError,lambda:m.ExactOutputOracle("o","bytes_base64").evaluate("c","***","***"))
def test_state_transition_pass():
 x={"before":"idle","event":"start","after":"running"};assert m.ExactOutputOracle("o","state_transition").evaluate("c",x,x)["verdict_state"]=="PASS"
def test_invalid_transition_shape_refused():raises(m.ExactOutputError,lambda:m.ExactOutputOracle("o","state_transition").evaluate("c",{},{}))
def test_nan_json_refused():raises(m.ExactOutputError,lambda:m.ExactOutputOracle("o","canonical_json").evaluate("c",math.nan,math.nan))
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} exact-output-oracle tests")
if __name__=="__main__":run()
