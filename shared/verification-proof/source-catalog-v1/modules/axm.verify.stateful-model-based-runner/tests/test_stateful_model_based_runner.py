from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"stateful_model_based_runner.py";s=importlib.util.spec_from_file_location("stateful_model_based_runner",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
T=[{"from":"C","action":"open","to":"O"},{"from":"O","action":"close","to":"C"}]
def good(state,action):return {("C","open"):"O",("O","close"):"C"}[(state,action)]
def test_generates_paths():assert m.StatefulModelBasedRunner("x","C",T,2).sequences()==[["open"],["open","close"]]
def test_good_implementation_passes():assert m.StatefulModelBasedRunner("x","C",T,3).run("C",good)["verdict_state"]=="PASS"
def test_mismatch_fails():
 r=m.StatefulModelBasedRunner("x","C",T).run("C",lambda s,a:"C");assert r["verdict_state"]=="FAIL" and r["failure_trace"][0]["observed"]=="C"
def test_exception_fails():assert m.StatefulModelBasedRunner("x","C",T).run("C",lambda s,a:1/0)["exception"]["type"]=="ZeroDivisionError"
def test_observer_supported():
 def step(s,a):return {"state":good(s["state"],a)}
 assert m.StatefulModelBasedRunner("x","C",T).run({"state":"C"},step,lambda x:x["state"])["verdict_state"]=="PASS"
def test_depth_zero_no_sequences():assert m.StatefulModelBasedRunner("x","C",T,0).run("C",good)["sequences_explored"]==0
def test_sequence_ceiling():assert len(m.StatefulModelBasedRunner("x","C",T,5,1).sequences())==1
def test_ambiguous_refused():raises(m.StatefulModelError,lambda:m.StatefulModelBasedRunner("x","C",T+[{"from":"C","action":"open","to":"X"}]))
def test_invalid_bounds_refused():raises(m.StatefulModelError,lambda:m.StatefulModelBasedRunner("x","C",T,-1))
def test_boundary_bounded_not_authority():
 r=m.StatefulModelBasedRunner("x","C",T).run("C",good);assert r["complete_state_space_proven"] is False and r["authority"]=="NONE" and r["canon"] is False

def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} stateful-model-based-runner tests")
if __name__=="__main__":run()
