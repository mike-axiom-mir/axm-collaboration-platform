from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "motion_sequence_proof.py"
SPEC = importlib.util.spec_from_file_location("motion_sequence_proof", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Proof=MODULE.MotionSequenceProof();FR=[{"index":0,"timestamp_ms":0,"digest":"a"},{"index":1,"timestamp_ms":16,"digest":"b","continuous_from_previous":True}];C={"max_gap_ms":20,"max_duration_ms":100,"continuity_required":True};P={"native_surface":"player","status":"PASS"}
def test_valid_passes():assert Proof.verify(FR,C,P)['verdict_state']=="PASS"
def test_missing_playback_unknown():assert Proof.verify(FR,C)['verdict_state']=="UNKNOWN"
def test_gap_fails():assert Proof.verify([FR[0],{**FR[1],"timestamp_ms":30}],C,P)['verdict_state']=="FAIL"
def test_nonmonotonic_fails():assert Proof.verify([FR[0],{**FR[1],"timestamp_ms":0}],C,P)['verdict_state']=="FAIL"
def test_index_gap_fails():assert Proof.verify([FR[0],{**FR[1],"index":2}],C,P)['verdict_state']=="FAIL"
def test_declared_discontinuity_fails():assert Proof.verify([FR[0],{**FR[1],"continuous_from_previous":False}],C,P)['verdict_state']=="FAIL"
def test_duration_fails():assert Proof.verify([FR[0],{**FR[1],"timestamp_ms":120}],{**C,"max_gap_ms":200},P)['verdict_state']=="FAIL"
def test_playback_failure_fails():assert Proof.verify(FR,C,{**P,"status":"FAIL"})['verdict_state']=="FAIL"
def test_duplicate_index_refused():raises(MODULE.MotionProofError,lambda:Proof.verify([FR[0],{**FR[1],"index":0}],C,P))
def test_boundary_truth():
    result=Proof.verify(FR,C,P);assert result['frames_are_caller_supplied'] and result['aesthetic_quality_judged'] is False and result['authority']=="NONE" and result['canon'] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} motion-sequence-proof tests")

if __name__ == "__main__":
    run()
