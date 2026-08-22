from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'artifact_identity_hasher.py'
SPEC = importlib.util.spec_from_file_location('artifact_identity_hasher', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Hasher=MODULE.ArtifactIdentityHasher()
def test_bytes_are_exact():assert Hasher.identity(b"a")["byte_length"]==1
def test_text_is_utf8():assert Hasher.identity("é")["byte_length"]==2
def test_mapping_order_is_stable():assert Hasher.identity({"b":2,"a":1})["content_digest"]==Hasher.identity({"a":1,"b":2})["content_digest"]
def test_list_order_matters():assert Hasher.identity([1,2])["content_digest"]!=Hasher.identity([2,1])["content_digest"]
def test_scope_changes_identity_only():
    a=Hasher.identity({"x":1},scope="a");b=Hasher.identity({"x":1},scope="b");assert a["content_digest"]==b["content_digest"] and a["identity_digest"]!=b["identity_digest"]
def test_type_changes_identity():assert Hasher.identity("x",artifact_type="file")["identity_digest"]!=Hasher.identity("x",artifact_type="dataset")["identity_digest"]
def test_nonfinite_refused():raises(MODULE.ArtifactIdentityError,lambda:Hasher.identity(float("nan")))
def test_nonstring_key_refused():raises(MODULE.ArtifactIdentityError,lambda:Hasher.identity({1:"x"}))
def test_unsupported_value_refused():raises(MODULE.ArtifactIdentityError,lambda:Hasher.identity({"x":object()}))
def test_boundary_truth():
    result=Hasher.identity("x");assert result["semantic_equivalence_proven"] is False and result["authority"]=="NONE" and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} artifact-identity-hasher tests")

if __name__ == "__main__":
    run()
