from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"coverage_guided_fuzz_harness.py";s=importlib.util.spec_from_file_location("coverage_guided_fuzz_harness",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def target(data):return {"coverage":[len(data),data[:1].hex()],"violation":b"BAD" in data,"details":"marker"}
def test_seed_violation_found():
 r=m.CoverageGuidedFuzzHarness("x",max_cases=5).run([b"xxBADyy"],target);assert r["verdict_state"]=="FAIL"
def test_violation_minimized():
 r=m.CoverageGuidedFuzzHarness("x",max_cases=5).run([b"xxBADyy"],target);assert bytes.fromhex(r["minimized_input_hex"])==b"BAD"
def test_exception_recorded():
 r=m.CoverageGuidedFuzzHarness("x",max_cases=2).run([b"x"],lambda d:1/0);assert r["failure"]["kind"]=="EXCEPTION"
def test_clean_bounded_run_passes():assert m.CoverageGuidedFuzzHarness("x",max_cases=4).run([b"A"],lambda d:{"coverage":[len(d)]})["verdict_state"]=="PASS"
def test_deterministic():
 a=m.CoverageGuidedFuzzHarness("x",seed=4,max_cases=10).run([b"A"],lambda d:{"coverage":[d.hex()]});b=m.CoverageGuidedFuzzHarness("x",seed=4,max_cases=10).run([b"A"],lambda d:{"coverage":[d.hex()]});assert a["coverage_tokens"]==b["coverage_tokens"]
def test_case_ceiling():assert m.CoverageGuidedFuzzHarness("x",max_cases=3).run([b"A"],lambda d:{"coverage":[]})["cases_executed"]==3
def test_empty_corpus_refused():raises(m.FuzzHarnessError,lambda:m.CoverageGuidedFuzzHarness("x").run([],target))
def test_oversized_seed_refused():raises(m.FuzzHarnessError,lambda:m.CoverageGuidedFuzzHarness("x",max_input_bytes=1).run([b"AB"],target))
def test_invalid_target_result_refused():raises(m.FuzzHarnessError,lambda:m.CoverageGuidedFuzzHarness("x").run([b"A"],lambda d:[]))
def test_boundary_bounded_no_authority():
 r=m.CoverageGuidedFuzzHarness("x",max_cases=1).run([b"A"],lambda d:{"coverage":[]});assert r["bounded_campaign_only"] is True and r["external_commands_executed"] is False and r["authority"]=="NONE" and r["canon"] is False

def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} coverage-guided-fuzz-harness tests")
if __name__=="__main__":run()
