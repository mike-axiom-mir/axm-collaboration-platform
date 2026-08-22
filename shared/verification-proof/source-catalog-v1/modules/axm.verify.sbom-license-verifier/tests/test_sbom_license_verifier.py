from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'sbom_license_verifier.py'
SPEC = importlib.util.spec_from_file_location('sbom_license_verifier', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Verifier=MODULE.SBOMLicenseVerifier();B={"complete":True,"components":[{"bom_ref":"root","name":"app","version":"1","hashes":{"sha256":"a"},"licenses":["MIT"]},{"bom_ref":"lib","name":"lib","version":"2","hashes":{"sha256":"b"},"licenses":["Apache-2.0"]}],"relationships":[{"from":"root","to":"lib","type":"DEPENDS_ON"}]};P={"denied_licenses":["GPL-3.0"],"required_components":["lib"],"require_hash":True}
def test_valid_bom_passes():assert Verifier.verify(B,P)["verdict_state"]=="PASS"
def test_denied_license_fails():
    b={**B,"components":[{**B["components"][0],"licenses":["GPL-3.0"]},B["components"][1]]};assert Verifier.verify(b,P)["verdict_state"]=="FAIL"
def test_missing_hash_fails():
    b={**B,"components":[{**B["components"][0],"hashes":{}},B["components"][1]]};assert Verifier.verify(b,P)["verdict_state"]=="FAIL"
def test_missing_required_component_fails():assert Verifier.verify(B,{**P,"required_components":["other"]})["verdict_state"]=="FAIL"
def test_incomplete_is_unknown():assert Verifier.verify({**B,"complete":False},P)["verdict_state"]=="UNKNOWN"
def test_duplicate_component_refused():raises(MODULE.SBOMVerifierError,lambda:Verifier.verify({**B,"components":B["components"]+[B["components"][0]]},P))
def test_unknown_relationship_refused():raises(MODULE.SBOMVerifierError,lambda:Verifier.verify({**B,"relationships":[{"from":"root","to":"x","type":"DEPENDS_ON"}]},P))
def test_bad_license_refused():
    b={**B,"components":[{**B["components"][0],"licenses":[""]},B["components"][1]]};raises(MODULE.SBOMVerifierError,lambda:Verifier.verify(b,P))
def test_component_count_reported():assert Verifier.verify(B,P)["component_count"]==2
def test_boundary_truth():
    result=Verifier.verify(B,P);assert result["legal_advice_provided"] is False and result["package_resolution_performed"] is False and result["sbom_completeness_proven"] is False and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} sbom-license-verifier tests")

if __name__ == "__main__":
    run()
