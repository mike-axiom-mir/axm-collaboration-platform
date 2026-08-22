from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"hermetic_environment_descriptor.py";s=importlib.util.spec_from_file_location("hermetic_environment_descriptor",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def env(i="a",net="OFFLINE",deps=("b","a"),limits=(("memory_mb",512),)):return m.HermeticEnvironmentDescriptor(i,"Python 3.13","Linux","x86_64",deps,("python",),("read",),net,limits)
def test_canonical_sorting():assert env().dependencies==("a","b")
def test_digest_deterministic():assert env().digest()==env().digest()
def test_descriptor_id_changes_digest():assert env("a").digest()!=env("b").digest()
def test_equal_compare_pass():assert env("a").compare(env("b"))["verdict_state"]=="PASS"
def test_network_mismatch_fail():assert "network_state" in env(net="OFFLINE").compare(env(net="OPEN"))["mismatches"]
def test_dependency_mismatch_fail():assert env(deps=("a",)).compare(env(deps=("a","b")))["verdict_state"]=="FAIL"
def test_duplicate_dependency_refused():raises(m.EnvironmentDescriptorError,lambda:env(deps=("a","a")))
def test_negative_limit_refused():raises(m.EnvironmentDescriptorError,lambda:env(limits=(("memory_mb",-1),)))
def test_mapping_alias_os():assert m.HermeticEnvironmentDescriptor.from_mapping({"descriptor_id":"x","runtime":"r","os":"Linux","architecture":"a","network_state":"OFFLINE"}).os_name=="Linux"
def test_boundary_no_sandbox_claim():
 r=env().compare(env("b"));assert r["hermetic_execution_proven"] is False and r["authority"]=="NONE" and r["canon"] is False
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} hermetic-environment-descriptor tests")
if __name__=="__main__":run()
