from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'signature_keyless_verifier.py'
SPEC = importlib.util.spec_from_file_location('signature_keyless_verifier', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Verifier=MODULE.SignatureKeylessVerifier();E={"signature_status":"PASS","certificate":{"subject":"me@example","issuer":"issuer","trust_root":"root","not_before":"2026-01-01T00:00:00Z","not_after":"2027-01-01T00:00:00Z","revocation_status":"PASS"},"transparency_inclusion_status":"PASS"};P={"allowed_subjects":["me@example"],"allowed_issuers":["issuer"],"trusted_roots":["root"],"require_transparency":True};NOW="2026-07-27T00:00:00Z"
def test_valid_receipt_passes():assert Verifier.evaluate(E,P,NOW)["verdict_state"]=="PASS"
def test_subject_mismatch_fails():assert Verifier.evaluate({**E,"certificate":{**E["certificate"],"subject":"x"}},P,NOW)["verdict_state"]=="FAIL"
def test_issuer_mismatch_fails():assert Verifier.evaluate({**E,"certificate":{**E["certificate"],"issuer":"x"}},P,NOW)["verdict_state"]=="FAIL"
def test_root_mismatch_fails():assert Verifier.evaluate({**E,"certificate":{**E["certificate"],"trust_root":"x"}},P,NOW)["verdict_state"]=="FAIL"
def test_expired_fails():assert Verifier.evaluate(E,P,"2028-01-01T00:00:00Z")["verdict_state"]=="FAIL"
def test_revoked_fails():assert Verifier.evaluate({**E,"certificate":{**E["certificate"],"revocation_status":"FAIL"}},P,NOW)["verdict_state"]=="FAIL"
def test_unknown_signature_unknown():assert Verifier.evaluate({**E,"signature_status":"UNKNOWN"},P,NOW)["verdict_state"]=="UNKNOWN"
def test_missing_transparency_unknown():assert Verifier.evaluate({**E,"transparency_inclusion_status":"NOT_RUN"},P,NOW)["verdict_state"]=="UNKNOWN"
def test_naive_time_refused():raises(MODULE.SignatureVerifierError,lambda:Verifier.evaluate(E,P,"2026-01-01T00:00:00"))
def test_boundary_truth():
    result=Verifier.evaluate(E,P,NOW);assert result["cryptographic_verification_performed"] is False and result["native_verification_receipt_required"] and result["identity_ownership_proven"] is False and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} signature-keyless-verifier tests")

if __name__ == "__main__":
    run()
