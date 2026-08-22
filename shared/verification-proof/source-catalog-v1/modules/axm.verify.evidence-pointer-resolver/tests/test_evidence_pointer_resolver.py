from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'evidence_pointer_resolver.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.evidence_pointer_resolver', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
R=MODULE.EvidencePointerResolver();D="a"*64
def test_relative_resolves():assert R.resolve({"type":"relative","path":"a/b"},{"relative":{"a/b":{"target":"x","status":"ACTIVE"}}})["pointer_state"]=="RESOLVED"
def test_content_resolves():assert R.resolve({"type":"content_addressed","sha256":D},{"content":{D:{"target":"blob","status":"ACTIVE"}}})["verdict_state"]=="PASS"
def test_archive_member_resolves():assert R.resolve({"type":"archive","archive_id":"z","member":"a.txt"},{"archives":{"z":{"members":{"a.txt":{"target":"member","status":"ACTIVE"}}}}})["pointer_state"]=="RESOLVED"
def test_source_line_resolves():assert R.resolve({"type":"source_line","source_id":"s","start":2,"end":3},{"sources":{"s":{"target":"file","line_count":3,"status":"ACTIVE"}}})["target"]["line_range"]==[2,3]
def test_receipt_resolves():assert R.resolve({"type":"receipt","receipt_id":"r"},{"receipts":{"r":{"target":"receipt","status":"ACTIVE"}}})["verdict_state"]=="PASS"
def test_native_surface_resolves():assert R.resolve({"type":"native_surface","surface_id":"n"},{"native_surfaces":{"n":{"target":"viewer","status":"ACTIVE"}}})["verdict_state"]=="PASS"
def test_parent_traversal_refused():raises(MODULE.EvidencePointerError,lambda:R.resolve({"type":"relative","path":"../x"},{}))
def test_stale_is_unknown():assert R.resolve({"type":"receipt","receipt_id":"r"},{"receipts":{"r":{"target":"x","status":"STALE"}}})["verdict_state"]=="UNKNOWN"
def test_missing_is_broken():assert R.resolve({"type":"receipt","receipt_id":"r"},{})["pointer_state"]=="BROKEN"
def test_boundary_truth():
    out=R.resolve({"type":"receipt","receipt_id":"r"},{"receipts":{"r":{"target":"x","status":"ACTIVE"}}});assert out["network_accessed"] is False and out["filesystem_accessed"] is False and out["canon"] is False
def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} evidence-pointer-resolver tests")

if __name__ == "__main__":
    run()
