from pathlib import Path
from tempfile import TemporaryDirectory
import importlib.util
import json

MODULE_PATH = Path(__file__).parents[1] / "src" / "typed_claim_registry.py"
import sys

spec = importlib.util.spec_from_file_location("typed_claim_registry", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)

def base_claim():
    return {
        "claim_id": "claim.demo.001",
        "claim_type": "functional",
        "subject": "demo-artifact@sha256:abc",
        "scope": {"artifact_version": "0.1.0", "environment": "local-test"},
        "risk": "medium",
        "owner": "human",
        "status": "NOT_RUN",
        "required_proof_surfaces": ["contract-test", "native-observation"],
    }

def expect_raises(exc_type, fn):
    try:
        fn()
    except exc_type:
        return
    raise AssertionError(f"expected {exc_type.__name__}")

def test_all_canonical_verdicts_remain_distinct():
    assert len(mod.CANONICAL_VERDICTS) == 7
    assert len(set(mod.CANONICAL_VERDICTS)) == 7

def test_valid_claim_roundtrip():
    with TemporaryDirectory() as temp:
        path = Path(temp) / "claims.jsonl"
        registry = mod.TypedClaimRegistry(path)
        stored = registry.register(base_claim())
        assert stored["status"] == "NOT_RUN"
        assert registry.get("claim.demo.001") == stored
        assert registry.snapshot()["claim_count"] == 1

def test_duplicate_refused_without_rewrite():
    with TemporaryDirectory() as temp:
        path = Path(temp) / "claims.jsonl"
        registry = mod.TypedClaimRegistry(path)
        registry.register(base_claim())
        before = path.read_bytes()
        expect_raises(mod.DuplicateClaimError, lambda: registry.register(base_claim()))
        assert path.read_bytes() == before

def test_missing_field_refused():
    claim = base_claim()
    claim.pop("scope")
    expect_raises(mod.ClaimValidationError, lambda: mod.validate_claim(claim))

def test_invalid_status_refused():
    claim = base_claim()
    claim["status"] = "MAYBE"
    expect_raises(mod.ClaimValidationError, lambda: mod.validate_claim(claim))

def test_empty_scope_refused():
    claim = base_claim()
    claim["scope"] = {}
    expect_raises(mod.ClaimValidationError, lambda: mod.validate_claim(claim))

def test_empty_proof_surface_refused():
    claim = base_claim()
    claim["required_proof_surfaces"] = []
    expect_raises(mod.ClaimValidationError, lambda: mod.validate_claim(claim))

def test_duplicate_surface_refused():
    claim = base_claim()
    claim["required_proof_surfaces"] = ["visual", "visual"]
    expect_raises(mod.ClaimValidationError, lambda: mod.validate_claim(claim))

def test_deterministic_sort_order():
    with TemporaryDirectory() as temp:
        path = Path(temp) / "claims.jsonl"
        registry = mod.TypedClaimRegistry(path)
        b = base_claim()
        b["claim_id"] = "claim.b"
        a = base_claim()
        a["claim_id"] = "claim.a"
        registry.register(b)
        registry.register(a)
        assert [c["claim_id"] for c in registry.list_claims()] == ["claim.a", "claim.b"]

def test_corrupt_duplicate_storage_detected():
    with TemporaryDirectory() as temp:
        path = Path(temp) / "claims.jsonl"
        registry = mod.TypedClaimRegistry(path)
        registry.register(base_claim())
        raw = path.read_text(encoding="utf-8")
        path.write_text(raw + raw, encoding="utf-8")
        expect_raises(mod.CorruptRegistryError, registry.list_claims)

def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
    print(f"PASS {len(tests)} typed-claim-registry tests")

if __name__ == "__main__":
    run()
