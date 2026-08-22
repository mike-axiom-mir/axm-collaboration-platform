from pathlib import Path
import importlib.util
import sys

MODULE_PATH = Path(__file__).parents[1] / "src" / "proof_freshness_expiry_policy.py"
spec = importlib.util.spec_from_file_location("proof_freshness_expiry_policy", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)

def expect_raises(exc_type, fn):
    try:
        fn()
    except exc_type:
        return
    raise AssertionError(f"expected {exc_type.__name__}")

def policy(max_age=100):
    return mod.FreshnessPolicy("p1", ["artifact", "environment"], max_age)

def receipt():
    return {"proof_id": "proof1", "issued_at": "2026-07-27T00:00:00Z", "context": {"artifact": "a1", "environment": {"python": "3.13"}}}

def test_fresh_when_same_and_within_age():
    result = policy().evaluate(receipt(), {"artifact": "a1", "environment": {"python": "3.13"}}, "2026-07-27T00:01:00Z")
    assert result["freshness_state"] == "FRESH"
    assert result["recommended_verdict_state"] is None
    assert result["fresh_means_pass"] is False

def test_context_change_is_stale():
    result = policy().evaluate(receipt(), {"artifact": "a2", "environment": {"python": "3.13"}}, "2026-07-27T00:01:00Z")
    assert result["freshness_state"] == "STALE"
    assert result["stale_reasons"][0]["reason"] == "CONTEXT_CHANGED"

def test_age_expiry_is_stale():
    result = policy(30).evaluate(receipt(), {"artifact": "a1", "environment": {"python": "3.13"}}, "2026-07-27T00:01:00Z")
    assert result["freshness_state"] == "STALE"
    assert any(reason["reason"] == "MAX_AGE_EXCEEDED" for reason in result["stale_reasons"])

def test_missing_current_dimension_unknown():
    result = policy().evaluate(receipt(), {"artifact": "a1"}, "2026-07-27T00:01:00Z")
    assert result["freshness_state"] == "UNKNOWN"
    assert result["recommended_verdict_state"] == "UNKNOWN"

def test_missing_proof_dimension_unknown():
    bad = receipt(); bad["context"].pop("environment")
    result = policy().evaluate(bad, {"artifact": "a1", "environment": {"python": "3.13"}}, "2026-07-27T00:01:00Z")
    assert result["freshness_state"] == "UNKNOWN"

def test_future_receipt_unknown():
    result = policy().evaluate(receipt(), {"artifact": "a1", "environment": {"python": "3.13"}}, "2026-07-26T23:59:00Z")
    assert result["freshness_state"] == "UNKNOWN"
    assert result["age_seconds"] < 0

def test_invalid_naive_timestamp_refused():
    bad = receipt(); bad["issued_at"] = "2026-07-27T00:00:00"
    expect_raises(mod.FreshnessPolicyError, lambda: policy().evaluate(bad, {}, "2026-07-27T00:01:00Z"))

def test_duplicate_dimension_refused():
    expect_raises(mod.FreshnessPolicyError, lambda: mod.FreshnessPolicy("p", ["artifact", "artifact"]))

def test_negative_max_age_refused():
    expect_raises(mod.FreshnessPolicyError, lambda: mod.FreshnessPolicy("p", ["artifact"], -1))

def test_exact_structural_comparison():
    r = receipt(); current = {"artifact": "a1", "environment": {"python": "3.13", "extra": True}}
    assert policy().evaluate(r, current, "2026-07-27T00:01:00Z")["freshness_state"] == "STALE"

def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
    print(f"PASS {len(tests)} proof-freshness-expiry-policy tests")

if __name__ == "__main__":
    run()
