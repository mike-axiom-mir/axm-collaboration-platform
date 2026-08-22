from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'summary_source_binding.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.summary_source_binding', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
D="a"*64
B=MODULE.SummarySourceBinding()
def summary(refs=None):return {"summary_id":"s1","text":"summary","claims":[{"claim_id":"c1","text":"claim","source_refs":refs if refs is not None else [{"source_id":"src","digest":D,"locator":"L1"}]}]}
def sources(status="PASS",digest=D,locator="L1"):return {"src":{"digest":digest,"locator":locator,"availability_status":status}}
def test_exact_binding_passes():assert B.bind(summary(),sources())["verdict_state"]=="PASS"
def test_missing_source_fails():assert B.bind(summary(),{})["verdict_state"]=="FAIL"
def test_digest_mismatch_fails():assert B.bind(summary(),sources(digest="b"*64))["verdict_state"]=="FAIL"
def test_locator_mismatch_fails():assert B.bind(summary(),sources(locator="L2"))["verdict_state"]=="FAIL"
def test_stale_source_is_unknown():assert B.bind(summary(),sources(status="STALE"))["verdict_state"]=="UNKNOWN"
def test_duplicate_claim_refused():
    s=summary();s["claims"].append(dict(s["claims"][0]));raises(MODULE.SummaryBindingError,lambda:B.bind(s,sources()))
def test_claim_without_refs_fails():assert B.bind(summary([]),sources())["verdict_state"]=="FAIL"
def test_binding_hash_is_deterministic():assert B.bind(summary(),sources())["binding_sha256"]==B.bind(summary(),sources())["binding_sha256"]
def test_invalid_digest_refused():raises(MODULE.SummaryBindingError,lambda:B.bind(summary([{"source_id":"src","digest":"bad","locator":"L1"}]),sources()))
def test_boundary_truth():
    out=B.bind(summary(),sources());assert out["semantic_support_proven"] is False and out["summary_authoritative"] is False and out["canon"] is False
def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} summary-source-binding tests")

if __name__ == "__main__":
    run()
