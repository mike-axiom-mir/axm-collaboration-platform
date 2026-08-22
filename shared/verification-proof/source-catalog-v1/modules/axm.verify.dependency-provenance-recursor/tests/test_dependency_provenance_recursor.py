from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'dependency_provenance_recursor.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.dependency_provenance_recursor', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
R=MODULE.DependencyProvenanceRecursor()
def node(deps=None,att="PASS",policy="PASS"):return {"dependencies":deps or [],"attestation_status":att,"policy_status":policy}
def test_clean_graph_passes():assert R.inspect({"a":node(["b"]),"b":node()},["a"])["verdict_state"]=="PASS"
def test_transitive_nodes_are_visited():assert R.inspect({"a":node(["b"]),"b":node(["c"]),"c":node()},["a"])["visited_components"]==["a","b","c"]
def test_missing_dependency_fails():assert R.inspect({"a":node(["b"])},["a"])["verdict_state"]=="FAIL"
def test_cycle_is_preserved_and_fails():
    out=R.inspect({"a":node(["b"]),"b":node(["a"])},["a"]);assert out["verdict_state"]=="FAIL" and out["cycles"]
def test_unknown_attestation_is_unknown():assert R.inspect({"a":node(att="UNKNOWN")},["a"])["verdict_state"]=="UNKNOWN"
def test_failed_attestation_fails():assert R.inspect({"a":node(att="FAIL")},["a"])["verdict_state"]=="FAIL"
def test_policy_failure_fails():assert R.inspect({"a":node(policy="FAIL")},["a"])["verdict_state"]=="FAIL"
def test_invalid_root_refused():raises(MODULE.DependencyProvenanceError,lambda:R.inspect({},[],10))
def test_node_bound_is_visible():
    out=R.inspect({"a":node(["b"]),"b":node()},["a"],1);assert out["verdict_state"]=="UNKNOWN" and out["truncated"] is True
def test_boundary_truth():
    out=R.inspect({"a":node()},["a"]);assert out["remote_fetch_performed"] is False and out["attestations_authenticated_by_module"] is False and out["canon"] is False
def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} dependency-provenance-recursor tests")

if __name__ == "__main__":
    run()
