from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"property_based_test_generator.py";s=importlib.util.spec_from_file_location("property_based_test_generator",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
I={"type":"integer","minimum":-10,"maximum":10}
def test_deterministic_examples():assert m.PropertyBasedTestGenerator("x",3).examples(I,8)==m.PropertyBasedTestGenerator("x",3).examples(I,8)
def test_integer_edges_present():
 e=m.PropertyBasedTestGenerator("x").examples(I,5);assert -10 in e and 10 in e and 0 in e
def test_passing_property():assert m.PropertyBasedTestGenerator("x").check(I,lambda x:-10<=x<=10,10)["verdict_state"]=="PASS"
def test_failure_shrinks_integer():
 r=m.PropertyBasedTestGenerator("x").check(I,lambda x:x<5,20);assert r["verdict_state"]=="FAIL" and r["shrunk_counterexample"]>=5
def test_text_strategy():
 r=m.PropertyBasedTestGenerator("x").check({"type":"text","alphabet":"ab","min_size":0,"max_size":5},lambda x:len(x)<5,10);assert r["verdict_state"]=="FAIL"
def test_list_strategy():
 r=m.PropertyBasedTestGenerator("x").check({"type":"list","items":{"type":"integer","minimum":0,"maximum":2},"min_size":0,"max_size":4},lambda x:len(x)<4,10);assert r["verdict_state"]=="FAIL"
def test_exception_recorded():
 r=m.PropertyBasedTestGenerator("x").check(I,lambda x:1/0,2);assert r["exception"]["type"]=="ZeroDivisionError"
def test_non_boolean_refused():raises(m.PropertyTestError,lambda:m.PropertyBasedTestGenerator("x").check(I,lambda x:1,2))
def test_invalid_strategy_refused():raises(m.PropertyTestError,lambda:m.PropertyBasedTestGenerator("x").examples({"type":"integer","minimum":2,"maximum":1},2))
def test_boundary_not_exhaustive_or_authoritative():
 r=m.PropertyBasedTestGenerator("x").check(I,lambda x:True,2);assert r["exhaustive"] is False and r["authority"]=="NONE" and r["canon"] is False

def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} property-based-test-generator tests")
if __name__=="__main__":run()
