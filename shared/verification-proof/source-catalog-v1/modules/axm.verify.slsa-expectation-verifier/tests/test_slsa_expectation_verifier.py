from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'slsa_expectation_verifier.py'
SPEC = importlib.util.spec_from_file_location('slsa_expectation_verifier', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Verifier=MODULE.SLSAExpectationVerifier();P={"verification_status":"PASS","builder_id":"b","source_uri":"git:x","build_type":"t","external_parameters":{"mode":"release"},"dependency_digests":{"lib":"d"},"complete":True};E={"allowed_builder_ids":["b"],"allowed_source_uris":["git:x"],"allowed_build_types":["t"],"allowed_external_parameters":["mode"],"required_dependency_digests":{"lib":"d"},"require_complete":True}
def test_matching_expectations_pass():assert Verifier.verify(P,E)["verdict_state"]=="PASS"
def test_builder_mismatch_fails():assert Verifier.verify({**P,"builder_id":"x"},E)["verdict_state"]=="FAIL"
def test_source_mismatch_fails():assert Verifier.verify({**P,"source_uri":"x"},E)["verdict_state"]=="FAIL"
def test_build_type_mismatch_fails():assert Verifier.verify({**P,"build_type":"x"},E)["verdict_state"]=="FAIL"
def test_unexpected_parameter_fails():assert Verifier.verify({**P,"external_parameters":{"secret":"x"}},E)["verdict_state"]=="FAIL"
def test_dependency_mismatch_fails():assert Verifier.verify({**P,"dependency_digests":{"lib":"x"}},E)["verdict_state"]=="FAIL"
def test_incomplete_fails():assert Verifier.verify({**P,"complete":False},E)["verdict_state"]=="FAIL"
def test_not_run_unknown():assert Verifier.verify({**P,"verification_status":"NOT_RUN"},E)["verdict_state"]=="UNKNOWN"
def test_bad_status_refused():raises(MODULE.SLSAExpectationError,lambda:Verifier.verify({**P,"verification_status":"MAYBE"},E))
def test_boundary_truth():
    result=Verifier.verify(P,E);assert result["slsa_level_assigned"] is False and result["provenance_authentication_performed"] is False and result["provenance_truth_proven"] is False and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} slsa-expectation-verifier tests")

if __name__ == "__main__":
    run()
