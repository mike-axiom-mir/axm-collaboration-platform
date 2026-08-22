from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'canonical_evidence_serializer.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.canonical_evidence_serializer', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
S=MODULE.CanonicalEvidenceSerializer()
def test_key_order_is_canonical():assert S.serialize({"b":2,"a":1})["canonical_bytes"]==b'{"a":1,"b":2}'
def test_same_value_has_same_hash():assert S.serialize({"a":[1,2]})["sha256"]==S.serialize({"a":[1,2]})["sha256"]
def test_unicode_is_nfc_normalized():assert S.serialize("e\u0301")["canonical_bytes"]==S.serialize("é")["canonical_bytes"]
def test_unicode_key_collision_refused():raises(MODULE.CanonicalEvidenceError,lambda:S.serialize({"e\u0301":1,"é":2}))
def test_float_refused():raises(MODULE.CanonicalEvidenceError,lambda:S.serialize({"x":1.5}))
def test_non_string_key_refused():raises(MODULE.CanonicalEvidenceError,lambda:S.serialize({1:"x"}))
def test_bytes_refused():raises(MODULE.CanonicalEvidenceError,lambda:S.serialize(b"x"))
def test_list_order_preserved():assert S.serialize([2,1])["canonical_bytes"]==b'[2,1]'
def test_boolean_and_null_supported():assert S.serialize({"a":True,"b":None})["canonical_bytes"]==b'{"a":true,"b":null}'
def test_boundary_truth():
    out=S.serialize({"claim":"supplied"});assert out["semantic_truth_proven"] is False and out["authority"]=="NONE" and out["canon"] is False
def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} canonical-evidence-serializer tests")

if __name__ == "__main__":
    run()
