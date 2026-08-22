from pathlib import Path
import importlib.util
import sys

MODULE_PATH = Path(__file__).parents[1] / "src" / "claim_proof_surface_router.py"
spec = importlib.util.spec_from_file_location("claim_proof_surface_router", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)

def expect_raises(exc_type, fn):
    try:
        fn()
    except exc_type:
        return
    raise AssertionError(f"expected {exc_type.__name__}")

def registry():
    return {
        "contract-test": {"verifier_id": "v.contract", "evidence_kind": "machine", "native_authority": True},
        "native-visual": {"verifier_id": "v.visual", "evidence_kind": "visual", "native_authority": True},
    }

def claim(surfaces=None):
    return {"claim_id": "c1", "claim_type": "visual", "required_proof_surfaces": surfaces or ["contract-test", "native-visual"]}

def test_all_declared_routes_available():
    result = mod.ProofSurfaceRouter(registry()).route(claim())
    assert result["route_state"] == "ROUTED"
    assert result["execution_state"] == "NOT_RUN"

def test_partial_route_keeps_missing_surface():
    result = mod.ProofSurfaceRouter(registry()).route(claim(["contract-test", "physical-device"]))
    assert result["route_state"] == "PARTIAL"
    assert result["routes"][1]["route_state"] == "UNROUTED"

def test_unrouted_is_not_unknown_verifier_guess():
    result = mod.ProofSurfaceRouter(registry()).route(claim(["mystery"]))
    assert result["route_state"] == "UNROUTED"
    assert result["routes"][0]["verifier"] is None

def test_defaults_are_suggestions_only():
    router = mod.ProofSurfaceRouter(registry(), {"visual": ["native-visual"]})
    result = router.route(claim(["contract-test"]))
    assert result["suggested_type_defaults"] == ["native-visual"]
    assert result["declared_surfaces"] == ["contract-test"]
    assert result["suggestions_auto_applied"] is False

def test_scope_missing_visible():
    assert mod.ProofSurfaceRouter(registry()).route(claim())["scope_state"] == "UNBOUND"

def test_partial_scope_visible():
    result = mod.ProofSurfaceRouter(registry()).route(claim(), {"binding_id": "scope:x", "binding_complete": False})
    assert result["scope_state"] == "BOUND_PARTIAL"

def test_invalid_registry_refused():
    expect_raises(mod.ProofSurfaceRoutingError, lambda: mod.ProofSurfaceRouter({"x": {}}))

def test_duplicate_claim_surface_refused():
    expect_raises(mod.ProofSurfaceRoutingError, lambda: mod.ProofSurfaceRouter(registry()).route(claim(["contract-test", "contract-test"])))

def test_empty_claim_surface_refused():
    bad = {"claim_id": "c1", "claim_type": "visual", "required_proof_surfaces": []}
    expect_raises(mod.ProofSurfaceRoutingError, lambda: mod.ProofSurfaceRouter(registry()).route(bad))

def test_native_authority_preserved_not_acquired():
    result = mod.ProofSurfaceRouter(registry()).route(claim(["native-visual"]))
    assert result["routes"][0]["verifier"]["native_authority"] is True
    assert result["authority"] == "NONE"

def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
    print(f"PASS {len(tests)} claim-proof-surface-router tests")

if __name__ == "__main__":
    run()
