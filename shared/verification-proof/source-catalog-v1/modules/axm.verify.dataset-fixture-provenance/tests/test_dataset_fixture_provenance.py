from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'dataset_fixture_provenance.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.dataset_fixture_provenance', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

V=MODULE.DatasetFixtureProvenanceVerifier();H="a"*64
def rec(**kw):
    x={"dataset_id":"d","version":"1","origins":["local"],"transformations":["none"],"permissions":{"status":"ALLOWED"},"splits":{"train":["a"],"test":["b"]},"checksums":{"all":H},"representativeness":{"population":"declared"},"limitations":["small"]};x.update(kw);return x
def test_complete_record_passes():assert V.verify(rec())["verdict_state"]=="PASS"
def test_missing_field_unknown():assert V.verify(rec(limitations=[]))["verdict_state"]=="UNKNOWN"
def test_checksum_match_passes():assert V.verify(rec(),{"all":H})["verdict_state"]=="PASS"
def test_checksum_mismatch_fails():assert V.verify(rec(),{"all":"b"*64})["verdict_state"]=="FAIL"
def test_invalid_checksum_fails():assert V.verify(rec(checksums={"all":"bad"}))["verdict_state"]=="FAIL"
def test_denied_permission_fails():assert V.verify(rec(permissions={"status":"DENIED"}))["verdict_state"]=="FAIL"
def test_unknown_permission_visible():assert "permissions.status" in V.verify(rec(permissions={"status":"UNKNOWN"}))["unknown_fields"]
def test_split_overlap_fails():assert V.verify(rec(splits={"train":["a"],"test":["a"]}))["verdict_state"]=="FAIL"
def test_non_mapping_refused():raises(MODULE.DatasetProvenanceError,lambda:V.verify([]))
def test_boundaries_preserved():
    out=V.verify(rec());assert out["representativeness_proven"] is False and out["permission_legality_proven"] is False and out["canon"] is False

def run():
    tests=[value for name,value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:test()
    print(f"PASS {len(tests)} dataset-fixture-provenance tests")
if __name__=="__main__":run()
