from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "visual_state_proof_binder.py"
SPEC = importlib.util.spec_from_file_location("visual_state_proof_binder", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Binder=MODULE.VisualStateProofBinder();ART={"artifact_id":"a","digest":"sha256:x"};REC=[{"receipt_id":"t","subject_digest":"sha256:x","status":"PASS"}];OBS={"observation_id":"o","artifact_digest":"sha256:x","native_surface":"browser","image_digest":"sha256:i","status":"PASS"};REV={"reviewer_id":"h","decision":"ACCEPT"}
def test_full_pass():assert Binder.bind(ART,REC,OBS,REV)['verdict_state']=="PASS"
def test_pixels_need_review():assert Binder.bind(ART,REC,OBS)['verdict_state']=="HUMAN_REVIEW"
def test_missing_observation_unknown():assert Binder.bind(ART,REC)['verdict_state']=="UNKNOWN"
def test_receipt_failure_fails():assert Binder.bind(ART,[{**REC[0],"status":"FAIL"}],OBS,REV)['verdict_state']=="FAIL"
def test_receipt_stale_unknown():assert Binder.bind(ART,[{**REC[0],"status":"STALE"}],OBS,REV)['verdict_state']=="UNKNOWN"
def test_receipt_identity_mismatch_fails():assert Binder.bind(ART,[{**REC[0],"subject_digest":"bad"}],OBS,REV)['identity_mismatches']
def test_observation_identity_mismatch_fails():assert Binder.bind(ART,REC,{**OBS,"artifact_digest":"bad"},REV)['verdict_state']=="FAIL"
def test_human_reject_fails():assert Binder.bind(ART,REC,OBS,{**REV,"decision":"REJECT"})['verdict_state']=="FAIL"
def test_duplicate_receipt_refused():raises(MODULE.VisualBindingError,lambda:Binder.bind(ART,REC+REC,OBS,REV))
def test_boundary_truth():
    result=Binder.bind(ART,REC,OBS);assert result['pixels_are_not_approval'] and result['receipt_truth_reverified'] is False and result['authority']=="NONE" and result['canon'] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} visual-state-proof-binder tests")

if __name__ == "__main__":
    run()
