from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"dependency_lock_verifier.py";s=importlib.util.spec_from_file_location("dependency_lock_verifier",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def e(i="a",v="1",h="0"*64,deps=()):return m.LockEntry(i,v,"local:"+i,h,deps)
def test_exact_pass():assert m.DependencyLockVerifier("v").verify([e()],[e()])["verdict_state"]=="PASS"
def test_missing_fail():assert m.DependencyLockVerifier("v").verify([e()],[ ])["missing"]==["a"]
def test_unexpected_fail():assert m.DependencyLockVerifier("v").verify([],[e()])["unexpected"]==["a"]
def test_version_mismatch():assert "version" in m.DependencyLockVerifier("v").verify([e(v="1")],[e(v="2")])["mismatches"][0]["fields"]
def test_hash_mismatch():assert "sha256" in m.DependencyLockVerifier("v").verify([e(h="0"*64)],[e(h="1"*64)])["mismatches"][0]["fields"]
def test_dependency_edge_mismatch():assert "dependencies" in m.DependencyLockVerifier("v").verify([e(deps=("b",))],[e()])["mismatches"][0]["fields"]
def test_invalid_hash_refused():raises(m.DependencyLockError,lambda:e(h="bad"))
def test_duplicate_identity_refused():raises(m.DependencyLockError,lambda:m.DependencyLockVerifier("v").verify([e(),e()],[e()]))
def test_self_dependency_refused():raises(m.DependencyLockError,lambda:e(deps=("a",)))
def test_boundary_not_safety_proof():
 r=m.DependencyLockVerifier("v").verify([e()],[e()]);assert r["dependency_safety_proven"] is False and r["canon"] is False
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} dependency-lock-verifier tests")
if __name__=="__main__":run()
