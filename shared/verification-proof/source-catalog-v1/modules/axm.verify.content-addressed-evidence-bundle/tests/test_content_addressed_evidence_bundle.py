from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'content_addressed_evidence_bundle.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.content_addressed_evidence_bundle', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
B=MODULE.ContentAddressedEvidenceBundle()
def obj(name,content=b"x",role="receipt",media="application/octet-stream"):return {"name":name,"content":content,"role":role,"media_type":media}
def test_single_object_bundles():assert B.bundle([obj("a.bin")])["logical_object_count"]==1
def test_duplicate_content_is_deduplicated():assert B.bundle([obj("a",b"x"),obj("b",b"x")])["unique_blob_count"]==1
def test_input_order_does_not_change_bundle_id():assert B.bundle([obj("b"),obj("a")])["bundle_id"]==B.bundle([obj("a"),obj("b")])["bundle_id"]
def test_parent_path_refused():raises(MODULE.EvidenceBundleError,lambda:B.bundle([obj("../a")]))
def test_duplicate_name_refused():raises(MODULE.EvidenceBundleError,lambda:B.bundle([obj("a"),obj("a",b"y")]))
def test_non_bytes_refused():raises(MODULE.EvidenceBundleError,lambda:B.bundle([{**obj("a"),"content":"x"}]))
def test_object_bound_enforced():raises(MODULE.EvidenceBundleError,lambda:B.bundle([obj("a"),obj("b")],1,10))
def test_byte_bound_enforced():raises(MODULE.EvidenceBundleError,lambda:B.bundle([obj("a",b"xx")],2,1))
def test_metadata_is_preserved():
    out=B.bundle([obj("a",b"x","fixture","text/plain")]);assert out["manifest"][0]["role"]=="fixture" and out["manifest"][0]["media_type"]=="text/plain"
def test_boundary_truth():
    out=B.bundle([obj("a")]);assert out["archive_written"] is False and out["published"] is False and out["canon"] is False
def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} content-addressed-evidence-bundle tests")

if __name__ == "__main__":
    run()
