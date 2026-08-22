from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'in_toto_attestation_adapter.py'
SPEC = importlib.util.spec_from_file_location('in_toto_attestation_adapter', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Adapter=MODULE.InTotoAttestationAdapter();ST={"_type":"https://in-toto.io/Statement/v1","subject":[{"name":"a","digest":{"sha256":"x"}}],"predicateType":"https://example/p","predicate":{"k":"v"}};EXP=ST["subject"]
def test_verified_binding_passes():assert Adapter.adapt(ST,EXP,{"verification_status":"PASS","signer_identity":"me"})["verdict_state"]=="PASS"
def test_missing_envelope_unknown():assert Adapter.adapt(ST,EXP)["verdict_state"]=="UNKNOWN"
def test_subject_mismatch_fails():assert Adapter.adapt(ST,[{"name":"a","digest":{"sha256":"z"}}],{"verification_status":"PASS"})["verdict_state"]=="FAIL"
def test_failed_envelope_fails():assert Adapter.adapt(ST,EXP,{"verification_status":"FAIL"})["verdict_state"]=="FAIL"
def test_unknown_envelope_unknown():assert Adapter.adapt(ST,EXP,{"verification_status":"UNKNOWN"})["verdict_state"]=="UNKNOWN"
def test_subjects_are_sorted():
    st={**ST,"subject":[{"name":"z","digest":{"sha256":"z"}},{"name":"a","digest":{"sha256":"a"}}]};assert Adapter.adapt(st)["subjects"][0]["name"]=="a"
def test_bad_type_refused():raises(MODULE.InTotoAdapterError,lambda:Adapter.adapt({**ST,"_type":"bad"}))
def test_duplicate_subject_refused():raises(MODULE.InTotoAdapterError,lambda:Adapter.adapt({**ST,"subject":EXP+EXP}))
def test_missing_predicate_refused():raises(MODULE.InTotoAdapterError,lambda:Adapter.adapt({k:v for k,v in ST.items() if k!="predicate"}))
def test_boundary_truth():
    result=Adapter.adapt(ST,EXP,{"verification_status":"PASS"});assert result["cryptographic_verification_performed"] is False and result["predicate_truth_proven"] is False and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} in-toto-attestation-adapter tests")

if __name__ == "__main__":
    run()
