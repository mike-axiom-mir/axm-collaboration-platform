from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'transparency_log_inclusion_proof.py'
SPEC = importlib.util.spec_from_file_location('transparency_log_inclusion_proof', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

import hashlib
Proof=MODULE.TransparencyLogInclusionProof()
def leaf(x):return hashlib.sha256(b"\x00"+x).digest()
def node(a,b):return hashlib.sha256(b"\x01"+a+b).digest()
def test_single_leaf_passes():
    root=leaf(b"a").hex();assert Proof.verify(b"a",{"leaf_index":0,"tree_size":1,"path":[]},{"root_hash":root,"signature_status":"PASS","log_id":"log"})["verdict_state"]=="PASS"
def test_right_sibling_passes():
    a,b=leaf(b"a"),leaf(b"b");root=node(a,b).hex();assert Proof.verify(b"a",{"leaf_index":0,"tree_size":2,"path":[{"position":"right","hash":b.hex()}]},{"root_hash":root,"signature_status":"PASS","log_id":"log"})["verdict_state"]=="PASS"
def test_left_sibling_passes():
    a,b=leaf(b"a"),leaf(b"b");root=node(a,b).hex();assert Proof.verify(b"b",{"leaf_index":1,"tree_size":2,"path":[{"position":"left","hash":a.hex()}]},{"root_hash":root,"signature_status":"PASS","log_id":"log"})["verdict_state"]=="PASS"
def test_wrong_root_fails():assert Proof.verify(b"a",{"leaf_index":0,"tree_size":1,"path":[]},{"root_hash":"00"*32,"signature_status":"PASS","log_id":"log"})["verdict_state"]=="FAIL"
def test_failed_signature_fails():
    root=leaf(b"a").hex();assert Proof.verify(b"a",{"leaf_index":0,"tree_size":1,"path":[]},{"root_hash":root,"signature_status":"FAIL","log_id":"log"})["verdict_state"]=="FAIL"
def test_unknown_signature_unknown():
    root=leaf(b"a").hex();assert Proof.verify(b"a",{"leaf_index":0,"tree_size":1,"path":[]},{"root_hash":root,"signature_status":"UNKNOWN","log_id":"log"})["verdict_state"]=="UNKNOWN"
def test_bad_index_refused():raises(MODULE.TransparencyProofError,lambda:Proof.verify(b"a",{"leaf_index":1,"tree_size":1,"path":[]},{"root_hash":"00"*32,"signature_status":"PASS","log_id":"log"}))
def test_bad_position_refused():raises(MODULE.TransparencyProofError,lambda:Proof.verify(b"a",{"leaf_index":0,"tree_size":1,"path":[{"position":"up","hash":"00"*32}]},{"root_hash":"00"*32,"signature_status":"PASS","log_id":"log"}))
def test_bad_hash_refused():raises(MODULE.TransparencyProofError,lambda:Proof.verify(b"a",{"leaf_index":0,"tree_size":1,"path":[]},{"root_hash":"zz","signature_status":"PASS","log_id":"log"}))
def test_boundary_truth():
    root=leaf(b"a").hex();result=Proof.verify(b"a",{"leaf_index":0,"tree_size":1,"path":[]},{"root_hash":root,"signature_status":"PASS","log_id":"log"});assert result["log_operator_authenticated_by_module"] is False and result["tree_consistency_proven"] is False and result["append_only_behavior_proven"] is False and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} transparency-log-inclusion-proof tests")

if __name__ == "__main__":
    run()
