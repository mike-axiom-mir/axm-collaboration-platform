from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"filesystem_environment_variance_matrix.py";s=importlib.util.spec_from_file_location("filesystem_environment_variance_matrix",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def dims():return {"path":["simple","nested"],"line":["LF","CRLF"],"perm":["rw","ro"]}
def test_full_cartesian_count():assert m.FilesystemEnvironmentVarianceMatrix("x",dims(),"FULL_CARTESIAN").compile()["case_count"]==8
def test_boundary_count():assert m.FilesystemEnvironmentVarianceMatrix("x",dims()).compile()["case_count"]==4
def test_boundary_covers_all_values():
 r=m.FilesystemEnvironmentVarianceMatrix("x",dims()).compile();assert all(len(v)==2 for v in r["value_coverage"].values())
def test_deterministic_ids():assert m.FilesystemEnvironmentVarianceMatrix("x",dims()).compile()["cases"]==m.FilesystemEnvironmentVarianceMatrix("x",dims()).compile()["cases"]
def test_cartesian_cap_refused():raises(m.VarianceMatrixError,lambda:m.FilesystemEnvironmentVarianceMatrix("x",dims(),"FULL_CARTESIAN",7).compile())
def test_boundary_cap_refused():raises(m.VarianceMatrixError,lambda:m.FilesystemEnvironmentVarianceMatrix("x",dims(),max_cases=3).compile())
def test_empty_dimension_refused():raises(m.VarianceMatrixError,lambda:m.FilesystemEnvironmentVarianceMatrix("x",{"a":[]}))
def test_duplicate_value_refused():raises(m.VarianceMatrixError,lambda:m.FilesystemEnvironmentVarianceMatrix("x",{"a":["x","x"]}))
def test_unknown_strategy_refused():raises(m.VarianceMatrixError,lambda:m.FilesystemEnvironmentVarianceMatrix("x",dims(),"random"))
def test_boundary_no_mutation_or_execution():
 r=m.FilesystemEnvironmentVarianceMatrix("x",dims()).compile();assert r["host_filesystem_mutated"] is False and r["host_environment_mutated"] is False and r["executed"] is False
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} filesystem-environment-variance-matrix tests")
if __name__=="__main__":run()
