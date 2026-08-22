from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"contract_conformance_harness.py";s=importlib.util.spec_from_file_location("contract_conformance_harness",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
C={"required_fields":{"name":"string","count":{"type":"integer","minimum":0}},"optional_fields":{"mode":{"type":"string","enum":["SAFE"]}},"allow_additional":False,"operations":{"start":{"allowed_from":["IDLE"],"next_state":"RUNNING"}},"refusal_states":["REFUSED"]}
def test_valid_payload_passes():assert m.ContractConformanceHarness(C).evaluate({"name":"x","count":1})["verdict_state"]=="PASS"
def test_missing_required_fails():assert m.ContractConformanceHarness(C).evaluate({"name":"x"})["findings"][0]["code"]=="MISSING_REQUIRED"
def test_type_mismatch_fails():assert any(x["code"]=="TYPE_MISMATCH" for x in m.ContractConformanceHarness(C).evaluate({"name":"x","count":True})["findings"])
def test_additional_field_fails():assert any(x["code"]=="ADDITIONAL_FIELD" for x in m.ContractConformanceHarness(C).evaluate({"name":"x","count":1,"z":2})["findings"])
def test_enum_fails():assert any(x["code"]=="ENUM_MISMATCH" for x in m.ContractConformanceHarness(C).evaluate({"name":"x","count":1,"mode":"FAST"})["findings"])
def test_lifecycle_passes():assert m.ContractConformanceHarness(C).evaluate({"name":"x","count":1},operation="start",current_state="IDLE",observed_state="RUNNING")["verdict_state"]=="PASS"
def test_lifecycle_mismatch_fails():assert any(x["code"]=="NEXT_STATE_MISMATCH" for x in m.ContractConformanceHarness(C).evaluate({"name":"x","count":1},operation="start",current_state="IDLE",observed_state="IDLE")["findings"])
def test_declared_refusal_passes():assert m.ContractConformanceHarness(C).evaluate({"name":"x","count":1},observed_state="REFUSED",refused=True)["verdict_state"]=="PASS"
def test_bad_contract_refused():raises(m.ContractConformanceError,lambda:m.ContractConformanceHarness({"required_fields":{"x":"weird"}}))
def test_boundary_target_not_executed():
 r=m.ContractConformanceHarness(C).evaluate({"name":"x","count":1});assert r["target_executed"] is False and r["authority"]=="NONE" and r["canon"] is False

def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} contract-conformance-harness tests")
if __name__=="__main__":run()
