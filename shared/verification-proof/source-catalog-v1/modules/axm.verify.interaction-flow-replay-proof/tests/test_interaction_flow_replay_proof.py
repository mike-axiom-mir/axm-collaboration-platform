from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "interaction_flow_replay_proof.py"
SPEC = importlib.util.spec_from_file_location("interaction_flow_replay_proof", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Proof=MODULE.InteractionFlowReplayProof();S=[{"index":0,"action":"tap","status":"PASS","expected_state_before":"idle","observed_state_before":"idle","expected_state_after":"open","observed_state_after":"open","expected_output":"panel","observed_output":"panel"},{"index":1,"action":"close","status":"PASS","observed_state_before":"open","observed_state_after":"idle","recovery_expected":True,"recovery_observed":True}]
def test_valid_passes():assert Proof.verify("f",S)['verdict_state']=="PASS"
def test_state_mismatch_fails():assert Proof.verify("f",[{**S[0],"observed_state_after":"bad"}])['verdict_state']=="FAIL"
def test_output_mismatch_fails():assert Proof.verify("f",[{**S[0],"observed_output":"bad"}])['verdict_state']=="FAIL"
def test_error_mismatch_fails():assert Proof.verify("f",[{**S[0],"error_expected":False,"error_observed":True}])['verdict_state']=="FAIL"
def test_recovery_mismatch_fails():assert Proof.verify("f",[{**S[0],"recovery_expected":True,"recovery_observed":False}])['verdict_state']=="FAIL"
def test_chain_mismatch_fails():assert Proof.verify("f",[S[0],{**S[1],"observed_state_before":"other"}])['verdict_state']=="FAIL"
def test_unknown_is_unknown():assert Proof.verify("f",[{**S[0],"status":"NOT_RUN"}])['verdict_state']=="UNKNOWN"
def test_ceiling_refused():raises(MODULE.InteractionReplayError,lambda:Proof.verify("f",S,max_steps=1))
def test_noncontiguous_refused():raises(MODULE.InteractionReplayError,lambda:Proof.verify("f",[{**S[0],"index":1}]))
def test_boundary_truth():
    result=Proof.verify("f",S);assert result['observations_are_caller_supplied'] and result['interaction_executed'] is False and result['authority']=="NONE" and result['canon'] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} interaction-flow-replay-proof tests")

if __name__ == "__main__":
    run()
