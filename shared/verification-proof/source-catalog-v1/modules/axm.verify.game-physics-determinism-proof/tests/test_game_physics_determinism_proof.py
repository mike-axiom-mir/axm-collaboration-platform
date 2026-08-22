from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "game_physics_determinism_proof.py"
SPEC = importlib.util.spec_from_file_location("game_physics_determinism_proof", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Proof=MODULE.GamePhysicsDeterminismProof();A={"run_id":"a","status":"PASS","fixed_step_ms":16,"seed":7,"input_order_digest":"i","checkpoints":[{"tick":0,"state_checksum":"s0"},{"tick":10,"state_checksum":"s1"}],"collision_events":[{"tick":5,"pair":"x-y"}],"authority_decisions":[{"tick":6,"owner":"host"}]};B={**A,"run_id":"b"}
def test_equal_passes():assert Proof.compare([A,B])['verdict_state']=="PASS"
def test_step_mismatch_fails():assert Proof.compare([A,{**B,"fixed_step_ms":17}])['verdict_state']=="FAIL"
def test_seed_mismatch_fails():assert Proof.compare([A,{**B,"seed":8}])['verdict_state']=="FAIL"
def test_input_order_mismatch_fails():assert Proof.compare([A,{**B,"input_order_digest":"j"}])['verdict_state']=="FAIL"
def test_state_mismatch_fails():assert Proof.compare([A,{**B,"checkpoints":[{"tick":0,"state_checksum":"x"}]}])['verdict_state']=="FAIL"
def test_collision_mismatch_fails():assert Proof.compare([A,{**B,"collision_events":[]}])['verdict_state']=="FAIL"
def test_authority_mismatch_fails():assert Proof.compare([A,{**B,"authority_decisions":[]}])['verdict_state']=="FAIL"
def test_unknown_is_unknown():assert Proof.compare([A,{**B,"status":"NOT_RUN"}])['verdict_state']=="UNKNOWN"
def test_duplicate_tick_refused():raises(MODULE.DeterminismProofError,lambda:Proof.compare([{**A,"checkpoints":[A['checkpoints'][0],A['checkpoints'][0]]},B]))
def test_boundary_truth():
    result=Proof.compare([A,B]);assert result['does_not_run_simulation'] and result['receipts_are_caller_supplied'] and result['determinism_scope_is_bounded'] and result['correctness_proven'] is False and result['canon'] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} game-physics-determinism-proof tests")

if __name__ == "__main__":
    run()
