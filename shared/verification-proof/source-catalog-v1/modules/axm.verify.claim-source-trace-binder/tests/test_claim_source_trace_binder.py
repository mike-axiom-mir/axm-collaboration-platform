from pathlib import Path
import importlib.util
import sys

MODULE_PATH = Path(__file__).parents[1] / "src" / "claim_source_trace_binder.py"
spec = importlib.util.spec_from_file_location("claim_source_trace_binder", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)

def expect_raises(exc_type, fn):
    try:
        fn()
    except exc_type:
        return
    raise AssertionError(f"expected {exc_type.__name__}")

def source(captured=True):
    copy_state = {"status": "CAPTURED", "path": "source.txt", "digest_algorithm": "sha256", "digest": "abc"} if captured else {"status": "NOT_CAPTURED", "reason": "remote source not archived"}
    return {
        "source_id": "s1",
        "source_type": "local_file",
        "title": "Source",
        "source_version": "sha256:abc",
        "locator": "source.txt",
        "location": {"lines": "1-3"},
        "observed_date": "2026-07-27",
        "excerpt": "Exact source text.",
        "local_evidence_copy": copy_state,
    }

def test_captured_source_binding():
    result = mod.bind_claim_to_source("c1", source())
    assert result["support_status"] == "UNCHECKED"
    assert result["quote_fidelity_status"] == "NOT_RUN"
    assert result["network_action"] == "NONE"

def test_not_captured_reason_preserved():
    result = mod.bind_claim_to_source("c1", source(False))
    assert result["source"]["local_evidence_copy"]["reason"] == "remote source not archived"

def test_captured_without_digest_refused():
    bad = source(); bad["local_evidence_copy"].pop("digest")
    expect_raises(mod.SourceTraceBindingError, lambda: mod.bind_claim_to_source("c1", bad))

def test_not_captured_without_reason_refused():
    bad = source(False); bad["local_evidence_copy"].pop("reason")
    expect_raises(mod.SourceTraceBindingError, lambda: mod.bind_claim_to_source("c1", bad))

def test_missing_version_refused():
    bad = source(); bad.pop("source_version")
    expect_raises(mod.SourceTraceBindingError, lambda: mod.bind_claim_to_source("c1", bad))

def test_empty_location_refused():
    bad = source(); bad["location"] = {}
    expect_raises(mod.SourceTraceBindingError, lambda: mod.bind_claim_to_source("c1", bad))

def test_empty_excerpt_refused():
    bad = source(); bad["excerpt"] = ""
    expect_raises(mod.SourceTraceBindingError, lambda: mod.bind_claim_to_source("c1", bad))

def test_trace_id_deterministic():
    assert mod.bind_claim_to_source("c1", source())["trace_id"] == mod.bind_claim_to_source("c1", source())["trace_id"]

def test_source_content_preserved():
    s = source(); result = mod.bind_claim_to_source("c1", s)
    assert result["source"]["excerpt"] == s["excerpt"]
    assert result["source"]["location"] == s["location"]

def test_no_authority():
    result = mod.bind_claim_to_source("c1", source())
    assert result["authority"] == "NONE"
    assert result["canon"] is False

def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
    print(f"PASS {len(tests)} claim-source-trace-binder tests")

if __name__ == "__main__":
    run()
