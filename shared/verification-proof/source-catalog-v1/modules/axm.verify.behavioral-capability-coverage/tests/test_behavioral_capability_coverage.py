from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "behavioral_capability_coverage.py"
SPEC = importlib.util.spec_from_file_location("behavioral_capability_coverage", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Mapper=MODULE.BehavioralCapabilityCoverageMapper()
CAPS=[{"capability_id":"save","required_behaviors":["write","reopen"]}]
def scenario(**kw): return {"scenario_id":"s1","capabilities":["save"],"behaviors":["write","reopen"],"proof_surfaces":["native-host"],"verdict_state":"PASS",**kw}
def test_covered_passes(): assert Mapper.map(CAPS,[scenario()])["verdict_state"]=="PASS"
def test_missing_behavior_partial(): assert Mapper.map(CAPS,[scenario(behaviors=["write"])])["capabilities"]["save"]["state"]=="PARTIAL"
def test_no_scenario_uncovered(): assert Mapper.map(CAPS,[])["capabilities"]["save"]["state"]=="UNCOVERED"
def test_failed_scenario_not_coverage(): assert Mapper.map(CAPS,[scenario(verdict_state="FAIL")])["capabilities"]["save"]["state"]=="UNCOVERED"
def test_surface_required(): assert Mapper.map(CAPS,[scenario(proof_surfaces=[])])["capabilities"]["save"]["state"]=="PARTIAL"
def test_surface_optional(): assert Mapper.map(CAPS,[scenario(proof_surfaces=[])],require_proof_surface=False)["verdict_state"]=="PASS"
def test_unknown_capability_refused(): raises(MODULE.CapabilityCoverageError,lambda:Mapper.map(CAPS,[{"scenario_id":"x","capabilities":["other"],"behaviors":[],"proof_surfaces":[]}]))
def test_duplicate_capability_refused(): raises(MODULE.CapabilityCoverageError,lambda:Mapper.map(CAPS+CAPS,[]))
def test_scenario_ids_unique(): raises(MODULE.CapabilityCoverageError,lambda:Mapper.map(CAPS,[scenario(),scenario()]))
def test_boundary_truth():
    result=Mapper.map(CAPS,[scenario()]);assert result["coverage_is_not_behavioral_correctness"] and result["authority"]=="NONE" and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} behavioral-capability-coverage tests")

if __name__ == "__main__":
    run()
