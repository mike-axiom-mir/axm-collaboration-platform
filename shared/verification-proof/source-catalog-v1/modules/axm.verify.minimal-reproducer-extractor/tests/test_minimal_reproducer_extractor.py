from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"minimal_reproducer_extractor.py";s=importlib.util.spec_from_file_location("minimal_reproducer_extractor",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def test_sequence_shrinks_to_triggers():
 r=m.MinimalReproducerExtractor("x").shrink_sequence(["n","x","m","y","q"],lambda a:"x" in a and "y" in a);assert set(r["result"])=={"x","y"} and len(r["result"])==2
def test_mapping_shrinks_key():
 r=m.MinimalReproducerExtractor("x").shrink_mapping({"a":1,"b":2,"c":3},lambda d:d.get("b")==2);assert r["result"]=={"b":2}
def test_bytes_shrinks_marker():
 r=m.MinimalReproducerExtractor("x").shrink_bytes(b"xxBADyy",lambda b:b"BAD" in b);assert bytes.fromhex(r["result"])==b"BAD"
def test_initial_nonfailure_refused():raises(m.MinimalReproducerError,lambda:m.MinimalReproducerExtractor("x").shrink_sequence([1],lambda x:False))
def test_predicate_must_bool():raises(m.MinimalReproducerError,lambda:m.MinimalReproducerExtractor("x").shrink_sequence([1],lambda x:1))
def test_invalid_budget_refused():raises(m.MinimalReproducerError,lambda:m.MinimalReproducerExtractor("x",0))
def test_empty_failing_can_return_empty():
 r=m.MinimalReproducerExtractor("x").shrink_sequence([],lambda x:True);assert r["result"]==[]
def test_budget_exhaustion_unknown():
 r=m.MinimalReproducerExtractor("x",1).shrink_sequence([1,2,3],lambda x:True);assert r["budget_exhausted"] is True and r["verdict_state"]=="UNKNOWN"
def test_reports_one_minimal_not_global():
 r=m.MinimalReproducerExtractor("x").shrink_sequence([1,2],lambda x:len(x)>=1);assert r["global_minimum_proven"] is False and r["minimality_claim"].startswith("ONE_MINIMAL")
def test_boundary_no_external_commands_or_authority():
 r=m.MinimalReproducerExtractor("x").shrink_sequence([1],lambda x:True);assert r["external_commands_executed"] is False and r["authority"]=="NONE" and r["canon"] is False
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} minimal-reproducer-extractor tests")
if __name__=="__main__":run()
