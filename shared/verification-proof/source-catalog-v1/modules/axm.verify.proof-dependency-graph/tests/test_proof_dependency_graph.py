from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "proof_dependency_graph.py"
SPEC = importlib.util.spec_from_file_location("axm.verify.proof_dependency_graph", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
G=MODULE.ProofDependencyGraph()
def nodes():return [{"id":"claim","type":"claim"},{"id":"receipt","type":"receipt"},{"id":"source","type":"source"}]
def test_acyclic_graph_passes():assert G.build(nodes(),[{"from":"claim","to":"receipt","relation":"supported_by"}])["verdict_state"]=="PASS"
def test_roots_reported():assert G.build(nodes(),[{"from":"claim","to":"receipt","relation":"supported_by"}])["roots"]==["claim","source"]
def test_topological_order_complete():assert len(G.build(nodes(),[{"from":"claim","to":"receipt","relation":"supported_by"}])["topological_order"])==3
def test_cycle_held_for_review():
    e=[{"from":"claim","to":"receipt","relation":"supported_by"},{"from":"receipt","to":"claim","relation":"depends_on"}];o=G.build(nodes(),e);assert o["verdict_state"]=="HUMAN_REVIEW" and o["cycle_resolved"] is False
def test_missing_endpoint_refused():raises(MODULE.ProofDependencyGraphError,lambda:G.build(nodes(),[{"from":"claim","to":"x","relation":"depends_on"}]))
def test_duplicate_node_refused():raises(MODULE.ProofDependencyGraphError,lambda:G.build(nodes()+[{"id":"claim","type":"claim"}],[]))
def test_unknown_node_type_refused():raises(MODULE.ProofDependencyGraphError,lambda:G.build([{"id":"x","type":"magic"}],[]))
def test_unknown_relation_refused():raises(MODULE.ProofDependencyGraphError,lambda:G.build(nodes(),[{"from":"claim","to":"source","relation":"proves"}]))
def test_self_dependency_refused():raises(MODULE.ProofDependencyGraphError,lambda:G.build(nodes(),[{"from":"claim","to":"claim","relation":"depends_on"}]))
def test_no_authority_or_canon():
    o=G.build(nodes(),[]);assert o["authority"]=="NONE" and o["canon"] is False

def run():
    tests=[v for n,v in sorted(globals().items()) if n.startswith("test_") and callable(v)]
    for t in tests:t()
    print(f"PASS {len(tests)} proof-dependency-graph tests")
if __name__=="__main__":run()
