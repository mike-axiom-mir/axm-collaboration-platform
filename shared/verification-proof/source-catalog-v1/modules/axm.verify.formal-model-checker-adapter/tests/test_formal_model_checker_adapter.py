from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"formal_model_checker_adapter.py";s=importlib.util.spec_from_file_location("formal_model_checker_adapter",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
A=m.FormalModelCheckerAdapter()
def req():return A.create_request(model="x",properties=["p"],assumptions=["a"],bounds={"steps":3},tool_name="t",tool_version="1")
def test_request_sealed():assert len(req()["request_sha256"])==64
def test_request_deterministic():assert req()["request_sha256"]==req()["request_sha256"]
def test_verified_maps_pass():assert A.normalize_result(req(),{"status":"VERIFIED"})["verdict_state"]=="PASS"
def test_counterexample_maps_fail():
 r=A.normalize_result(req(),{"status":"COUNTEREXAMPLE","counterexample":["a"]});assert r["verdict_state"]=="FAIL" and r["counterexample"]==["a"]
def test_unknown_preserved():assert A.normalize_result(req(),{"status":"UNKNOWN"})["verdict_state"]=="UNKNOWN"
def test_error_not_fail_claim():assert A.normalize_result(req(),{"status":"ERROR","diagnostics":["timeout"]})["verdict_state"]=="UNKNOWN"
def test_missing_trace_refused():raises(m.FormalAdapterError,lambda:A.normalize_result(req(),{"status":"COUNTEREXAMPLE"}))
def test_negative_bound_refused():raises(m.FormalAdapterError,lambda:A.create_request(model="x",properties=["p"],assumptions=[],bounds={"n":-1},tool_name="t",tool_version="1"))
def test_empty_properties_refused():raises(m.FormalAdapterError,lambda:A.create_request(model="x",properties=[],assumptions=[],bounds={},tool_name="t",tool_version="1"))
def test_boundary_caller_supplied_and_bounded():
 r=A.normalize_result(req(),{"status":"VERIFIED"});assert r["result_source"]=="CALLER_SUPPLIED" and r["bounded_scope_only"] is True and r["authority"]=="NONE" and r["canon"] is False

def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} formal-model-checker-adapter tests")
if __name__=="__main__":run()
