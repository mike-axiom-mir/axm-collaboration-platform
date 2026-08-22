from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'tamper_seal_reverification.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.tamper_seal_reverification', SOURCE)
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
V=MODULE.TamperSealReverification()
def seal(sid,value):return {"subject_id":sid,"algorithm":"sha256","digest":hashlib.sha256(value if isinstance(value,bytes) else __import__('json').dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()}
def test_matching_seal_passes():assert V.reverify({"a":b"x"},[seal("a",b"x")])["verdict_state"]=="PASS"
def test_json_subject_is_canonicalized():assert V.reverify({"a":{"b":2,"a":1}},[seal("a",{"a":1,"b":2})])["verdict_state"]=="PASS"
def test_mismatch_fails():assert V.reverify({"a":b"x"},[seal("a",b"y")])["verdict_state"]=="FAIL"
def test_missing_subject_fails():assert V.reverify({},[seal("a",b"x")])["verdict_state"]=="FAIL"
def test_broken_reference_fails():assert V.reverify({"a":b"x"},[seal("a",b"x")],[{"from_id":"a","to_id":"b"}])["verdict_state"]=="FAIL"
def test_failed_signature_fails():assert V.reverify({"a":b"x"},[seal("a",b"x")],signature_receipts=[{"subject_id":"a","status":"FAIL"}])["verdict_state"]=="FAIL"
def test_unknown_signature_is_unknown():assert V.reverify({"a":b"x"},[seal("a",b"x")],signature_receipts=[{"subject_id":"a","status":"UNKNOWN"}])["verdict_state"]=="UNKNOWN"
def test_invalid_digest_refused():raises(MODULE.SealReverificationError,lambda:V.reverify({"a":b"x"},[{"subject_id":"a","algorithm":"sha256","digest":"bad"}]))
def test_empty_seals_refused():raises(MODULE.SealReverificationError,lambda:V.reverify({"a":b"x"},[]))
def test_boundary_truth():
    out=V.reverify({"a":{"stored_verdict":"PASS"}},[seal("a",{"stored_verdict":"PASS"})]);assert out["stored_verdict_fields_trusted"] is False and out["signature_cryptography_performed"] is False and out["canon"] is False
def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} tamper-seal-reverification tests")

if __name__ == "__main__":
    run()
