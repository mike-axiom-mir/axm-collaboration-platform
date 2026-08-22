from pathlib import Path
import importlib.util
import sys

MODULE_PATH = Path(__file__).parents[1] / "src" / "claim_scope_context_binder.py"
spec = importlib.util.spec_from_file_location("claim_scope_context_binder", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)

def expect_raises(exc_type, fn):
    try:
        fn()
    except exc_type:
        return
    raise AssertionError(f"expected {exc_type.__name__}")

def claim():
    return {"claim_id": "claim.1", "subject": "artifact.1"}

def context():
    return {
        "artifact_versions": [{"artifact_id": "artifact.1", "version": "0.1"}],
        "environments": [{"environment_id": "test", "version": "python-3.13"}],
        "excluded_conditions": ["wan-enabled"],
    }

def test_complete_binding():
    binder = mod.ClaimScopeContextBinder(["artifact_versions", "environments"])
    result = binder.bind(claim(), context())
    assert result["binding_complete"] is True
    assert result["missing_required_dimensions"] == []
    assert result["context_truth_verified"] is False

def test_partial_binding_keeps_missing_visible():
    binder = mod.ClaimScopeContextBinder(["artifact_versions", "datasets"])
    result = binder.bind(claim(), context())
    assert result["binding_complete"] is False
    assert result["missing_required_dimensions"] == ["datasets"]

def test_deterministic_binding_id():
    binder = mod.ClaimScopeContextBinder()
    assert binder.bind(claim(), context())["binding_id"] == binder.bind(claim(), context())["binding_id"]

def test_order_normalized_for_identity():
    binder = mod.ClaimScopeContextBinder()
    a = context()
    a["artifact_versions"].append({"artifact_id": "artifact.0", "version": "0.1"})
    b = context()
    b["artifact_versions"] = list(reversed(a["artifact_versions"]))
    assert binder.bind(claim(), a)["binding_id"] == binder.bind(claim(), b)["binding_id"]

def test_unknown_dimension_refused():
    expect_raises(mod.ScopeBindingError, lambda: mod.validate_context({"mystery": {}}))

def test_duplicate_identity_refused():
    bad = {"devices": [{"device_id": "d", "profile": "a"}, {"device_id": "d", "profile": "b"}]}
    expect_raises(mod.ScopeBindingError, lambda: mod.validate_context(bad))

def test_empty_context_refused():
    expect_raises(mod.ScopeBindingError, lambda: mod.validate_context({}))

def test_invalid_required_dimension_refused():
    expect_raises(mod.ScopeBindingError, lambda: mod.ClaimScopeContextBinder(["unknown"]))

def test_extensions_preserved_not_interpreted():
    result = mod.ClaimScopeContextBinder().bind(claim(), {"extensions": {"project_specific": {"mode": "offline"}}})
    assert result["context"]["extensions"]["project_specific"]["mode"] == "offline"

def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
    print(f"PASS {len(tests)} claim-scope-context-binder tests")

if __name__ == "__main__":
    run()
