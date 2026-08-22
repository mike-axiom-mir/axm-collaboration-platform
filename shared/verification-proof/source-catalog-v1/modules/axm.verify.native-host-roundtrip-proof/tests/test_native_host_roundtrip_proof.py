from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'native_host_roundtrip_proof.py'
SPEC = importlib.util.spec_from_file_location('native_host_roundtrip_proof', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Proof=MODULE.NativeHostRoundtripProof();BASE={"receipt_id":"r1","host":{"name":"Blender","version":"4"},"status":"PASS","target_digest":"sha256:a","saved_digest":"sha256:a","reopened_digest":"sha256:a","inspected":True}
def test_equal_roundtrip_passes():assert Proof.verify(BASE)["verdict_state"]=="PASS"
def test_save_mismatch_fails():assert Proof.verify({**BASE,"saved_digest":"sha256:b"})["verdict_state"]=="FAIL"
def test_reopen_mismatch_fails():assert Proof.verify({**BASE,"reopened_digest":"sha256:b"})["verdict_state"]=="FAIL"
def test_uninspected_is_unknown():assert Proof.verify({**BASE,"inspected":False})["verdict_state"]=="UNKNOWN"
def test_not_run_is_unknown():assert Proof.verify({**BASE,"status":"NOT_RUN"})["verdict_state"]=="UNKNOWN"
def test_reported_failure_fails():assert Proof.verify({**BASE,"status":"FAIL"})["verdict_state"]=="FAIL"
def test_successful_rollback_passes():
    row={**BASE,"rollback_requested":True,"rollback_status":"PASS","pre_change_digest":"sha256:z","rollback_digest":"sha256:z"};assert Proof.verify(row)["verdict_state"]=="PASS"
def test_bad_rollback_fails():
    row={**BASE,"rollback_requested":True,"rollback_status":"PASS","pre_change_digest":"sha256:z","rollback_digest":"sha256:x"};assert Proof.verify(row)["verdict_state"]=="FAIL"
def test_missing_digest_refused():raises(MODULE.NativeHostProofError,lambda:Proof.verify({**BASE,"saved_digest":""}))
def test_boundary_truth():
    result=Proof.verify(BASE);assert result["does_not_launch_native_host"] and result["caller_supplied_receipt"] and result["visual_approval_not_implied"] and result["authority"]=="NONE" and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} native-host-roundtrip-proof tests")

if __name__ == "__main__":
    run()
