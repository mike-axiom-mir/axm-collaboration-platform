from pathlib import Path
from tempfile import TemporaryDirectory
import importlib.util
import sys

MODULE_PATH = Path(__file__).parents[1] / "src" / "requirement_traceability_graph.py"
spec = importlib.util.spec_from_file_location("requirement_traceability_graph", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)

def expect_raises(exc_type, fn):
    try:
        fn()
    except exc_type:
        return
    raise AssertionError(f"expected {exc_type.__name__}")

def node(nid, kind="REQUIREMENT"):
    return {"node_id": nid, "node_type": kind, "label": nid}

def edge(eid="e1"):
    return {"edge_id": eid, "from_id": "test", "to_id": "req", "relation": "TESTS"}

def test_add_nodes_edge_snapshot():
    with TemporaryDirectory() as temp:
        graph = mod.RequirementTraceabilityGraph(Path(temp) / "graph.jsonl")
        graph.add_node(node("req"))
        graph.add_node(node("test", "TEST"))
        graph.add_edge(edge())
        snap = graph.snapshot()
        assert snap["node_count"] == 2
        assert snap["edge_count"] == 1

def test_missing_endpoint_refused():
    with TemporaryDirectory() as temp:
        graph = mod.RequirementTraceabilityGraph(Path(temp) / "graph.jsonl")
        graph.add_node(node("req"))
        expect_raises(mod.TraceabilityGraphError, lambda: graph.add_edge(edge()))

def test_duplicate_node_refused():
    with TemporaryDirectory() as temp:
        graph = mod.RequirementTraceabilityGraph(Path(temp) / "graph.jsonl")
        graph.add_node(node("req"))
        expect_raises(mod.DuplicateTraceIdentityError, lambda: graph.add_node(node("req")))

def test_duplicate_edge_refused():
    with TemporaryDirectory() as temp:
        graph = mod.RequirementTraceabilityGraph(Path(temp) / "graph.jsonl")
        graph.add_node(node("req")); graph.add_node(node("test", "TEST")); graph.add_edge(edge())
        expect_raises(mod.DuplicateTraceIdentityError, lambda: graph.add_edge(edge()))

def test_invalid_node_type_refused():
    expect_raises(mod.TraceabilityGraphError, lambda: mod.validate_node(node("x", "MYSTERY")))

def test_invalid_relation_refused():
    bad = edge(); bad["relation"] = "LIKES"
    expect_raises(mod.TraceabilityGraphError, lambda: mod.validate_edge(bad))

def test_trace_returns_neighbors():
    with TemporaryDirectory() as temp:
        graph = mod.RequirementTraceabilityGraph(Path(temp) / "graph.jsonl")
        graph.add_node(node("req")); graph.add_node(node("test", "TEST")); graph.add_edge(edge())
        result = graph.trace("req")
        assert result["neighbors"][0]["node_id"] == "test"

def test_unlinked_requirement_visible():
    with TemporaryDirectory() as temp:
        graph = mod.RequirementTraceabilityGraph(Path(temp) / "graph.jsonl")
        graph.add_node(node("req"))
        assert graph.unlinked_requirements()[0]["node_id"] == "req"

def test_linked_requirement_not_reported_unlinked():
    with TemporaryDirectory() as temp:
        graph = mod.RequirementTraceabilityGraph(Path(temp) / "graph.jsonl")
        graph.add_node(node("req")); graph.add_node(node("test", "TEST")); graph.add_edge(edge())
        assert graph.unlinked_requirements() == []

def test_approval_node_has_no_authority():
    item = mod.validate_node(node("approval", "APPROVAL"))
    assert item["node_type"] == "APPROVAL"
    with TemporaryDirectory() as temp:
        graph = mod.RequirementTraceabilityGraph(Path(temp) / "graph.jsonl")
        graph.add_node(item)
        assert graph.snapshot()["authority"] == "NONE"

def test_snapshot_is_deterministic_sorted():
    with TemporaryDirectory() as temp:
        graph = mod.RequirementTraceabilityGraph(Path(temp) / "graph.jsonl")
        graph.add_node(node("z")); graph.add_node(node("a"))
        assert [n["node_id"] for n in graph.snapshot()["nodes"]] == ["a", "z"]

def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
    print(f"PASS {len(tests)} requirement-traceability-graph tests")

if __name__ == "__main__":
    run()
