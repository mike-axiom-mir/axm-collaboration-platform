from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"mutation_testing_scorecard.py";s=importlib.util.spec_from_file_location("mutation_testing_scorecard",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
A=m.MutationTestingScorecard()
def test_all_killed_passes():assert A.score([{"mutant_id":"a","status":"KILLED"}])["verdict_state"]=="PASS"
def test_low_score_fails():assert A.score([{"mutant_id":"a","status":"KILLED"},{"mutant_id":"b","status":"SURVIVED"}],0.8)["verdict_state"]=="FAIL"
def test_score_calculated():assert A.score([{"mutant_id":"a","status":"KILLED"},{"mutant_id":"b","status":"SURVIVED"}],0)["mutation_score"]==0.5
def test_timeout_unknown():assert A.score([{"mutant_id":"a","status":"KILLED"},{"mutant_id":"b","status":"TIMEOUT"}])["verdict_state"]=="UNKNOWN"
def test_equivalent_candidate_unknown():
 r=A.score([{"mutant_id":"a","status":"KILLED"},{"mutant_id":"b","status":"EQUIVALENT_CANDIDATE"}]);assert r["verdict_state"]=="UNKNOWN" and r["equivalent_candidates_excluded_from_score"] is True
def test_no_assessable_unknown():assert A.score([{"mutant_id":"a","status":"NOT_RUN"}])["mutation_score"] is None
def test_survivors_retained():assert A.score([{"mutant_id":"a","status":"SURVIVED"}],0)["survivors"][0]["mutant_id"]=="a"
def test_duplicate_refused():raises(m.MutationScoreError,lambda:A.score([{"mutant_id":"a","status":"KILLED"},{"mutant_id":"a","status":"SURVIVED"}]))
def test_invalid_threshold_refused():raises(m.MutationScoreError,lambda:A.score([{"mutant_id":"a","status":"KILLED"}],2))
def test_boundary_does_not_execute_or_prove_correctness():
 r=A.score([{"mutant_id":"a","status":"KILLED"}]);assert r["mutants_executed_by_scorecard"] is False and r["score_is_not_correctness"] is True and r["authority"]=="NONE" and r["canon"] is False

def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} mutation-testing-scorecard tests")
if __name__=="__main__":run()
