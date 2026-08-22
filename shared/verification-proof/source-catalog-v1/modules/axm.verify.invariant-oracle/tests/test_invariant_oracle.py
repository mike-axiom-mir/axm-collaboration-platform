from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"invariant_oracle.py";s=importlib.util.spec_from_file_location("invariant_oracle",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def one(op,path="/x",**kw):return [{"invariant_id":"i","operator":op,"path":path,**kw}]
def test_exists_pass():assert m.InvariantOracle("o").evaluate({"x":1},one("exists"))["verdict_state"]=="PASS"
def test_missing_exists_fails():assert m.InvariantOracle("o").evaluate({},one("exists"))["verdict_state"]=="FAIL"
def test_missing_nonexists_check_unknown():assert m.InvariantOracle("o").evaluate({},one("equals",expected=1))["verdict_state"]=="UNKNOWN"
def test_equals_type_strict():assert m.InvariantOracle("o").evaluate({"x":1},one("equals",expected=True))["verdict_state"]=="FAIL"
def test_type_integer_rejects_bool():assert m.InvariantOracle("o").evaluate({"x":True},one("type_is",expected_type="integer"))["verdict_state"]=="FAIL"
def test_bounds():
 o=m.InvariantOracle("o");assert o.evaluate({"x":5},one("min",expected=4))["verdict_state"]=="PASS";assert o.evaluate({"x":5},one("max",expected=4))["verdict_state"]=="FAIL"
def test_nonempty_and_contains():
 inv=[{"invariant_id":"a","operator":"NONEMPTY","path":"/x"},{"invariant_id":"b","operator":"CONTAINS","path":"/x","expected":"v"}];assert m.InvariantOracle("o").evaluate({"x":["v"]},inv)["verdict_state"]=="PASS"
def test_unique_fails_duplicates():assert m.InvariantOracle("o").evaluate({"x":[1,1]},one("unique"))["verdict_state"]=="FAIL"
def test_json_pointer_escape():assert m.InvariantOracle("o").evaluate({"a/b":{"~x":2}},one("equals","/a~1b/~0x",expected=2))["verdict_state"]=="PASS"
def test_duplicate_id_refused():
 x=one("exists")*2;raises(m.InvariantOracleError,lambda:m.InvariantOracle("o").evaluate({"x":1},x))
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} invariant-oracle tests")
if __name__=="__main__":run()
