from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"runtime_sanitizer_adapter.py";s=importlib.util.spec_from_file_location("runtime_sanitizer_adapter",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
A=m.RuntimeSanitizerAdapter()
def test_asan_finding():
 r=A.normalize(tool_name="ASan",tool_version="1",enabled=True,completed=True,exit_code=1,report_text="ERROR: AddressSanitizer: heap-use-after-free");assert r["verdict_state"]=="FAIL" and r["findings"][0]["kind"]=="ADDRESS"
def test_ubsan_finding():assert A.normalize(tool_name="UBSan",tool_version="1",enabled=True,completed=True,exit_code=1,report_text="runtime error: signed integer overflow")["findings"][0]["kind"]=="UNDEFINED_BEHAVIOR"
def test_tsan_finding():assert A.normalize(tool_name="TSan",tool_version="1",enabled=True,completed=True,exit_code=1,report_text="WARNING: ThreadSanitizer: data race")["findings"][0]["kind"]=="THREAD"
def test_lsan_finding():assert A.normalize(tool_name="LSan",tool_version="1",enabled=True,completed=True,exit_code=1,report_text="ERROR: LeakSanitizer: detected memory leaks")["findings"][0]["kind"]=="LEAK"
def test_clean_completed_passes():assert A.normalize(tool_name="ASan",tool_version="1",enabled=True,completed=True,exit_code=0,report_text="clean")["verdict_state"]=="PASS"
def test_disabled_not_run():assert A.normalize(tool_name="ASan",tool_version="1",enabled=False,completed=False,exit_code=None,report_text="")["verdict_state"]=="NOT_RUN"
def test_incomplete_unknown():assert A.normalize(tool_name="ASan",tool_version="1",enabled=True,completed=False,exit_code=None,report_text="")["verdict_state"]=="UNKNOWN"
def test_nonzero_without_finding_unknown():assert A.normalize(tool_name="ASan",tool_version="1",enabled=True,completed=True,exit_code=2,report_text="tool crashed")["verdict_state"]=="UNKNOWN"
def test_invalid_report_refused():raises(m.SanitizerAdapterError,lambda:A.normalize(tool_name="x",tool_version="1",enabled=True,completed=True,exit_code=0,report_text=None))
def test_boundary_no_execution_or_authority():
 r=A.normalize(tool_name="x",tool_version="1",enabled=True,completed=True,exit_code=0,report_text="");assert r["sanitizer_executed_by_adapter"] is False and r["clean_claim_scope"]=="SUPPLIED_COMPLETED_RUN_ONLY" and r["authority"]=="NONE" and r["canon"] is False

def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} runtime-sanitizer-adapter tests")
if __name__=="__main__":run()
