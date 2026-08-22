from pathlib import Path
import importlib.util,sys,math
P=Path(__file__).parents[1]/"src"/"statistical_tolerance_oracle.py";s=importlib.util.spec_from_file_location("statistical_tolerance_oracle",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def test_all_within_pass():assert m.StatisticalToleranceOracle("o",10,"all_within",absolute_tolerance=1).evaluate([9,10,11])["verdict_state"]=="PASS"
def test_all_within_fail():assert m.StatisticalToleranceOracle("o",10,"all_within",absolute_tolerance=1).evaluate([9,12])["verdict_state"]=="FAIL"
def test_mean_within_pass_despite_noise():assert m.StatisticalToleranceOracle("o",10,"mean_within",absolute_tolerance=.1).evaluate([9,11])["verdict_state"]=="PASS"
def test_proportion_policy():assert m.StatisticalToleranceOracle("o",10,"proportion_within",absolute_tolerance=1,required_proportion=.5).evaluate([10,20])["verdict_state"]=="PASS"
def test_min_samples_unknown():assert m.StatisticalToleranceOracle("o",10,absolute_tolerance=1,min_samples=3).evaluate([10,10])["verdict_state"]=="UNKNOWN"
def test_relative_tolerance():assert m.StatisticalToleranceOracle("o",100,absolute_tolerance=1,relative_tolerance=.05).evaluate([104])["effective_tolerance"]==5
def test_zero_target_relative_only_is_zero_tolerance():assert m.StatisticalToleranceOracle("o",0,absolute_tolerance=None,relative_tolerance=.1).evaluate([0])["verdict_state"]=="PASS"
def test_no_tolerance_refused():raises(m.StatisticalOracleError,lambda:m.StatisticalToleranceOracle("o",1))
def test_nan_observation_refused():raises(m.StatisticalOracleError,lambda:m.StatisticalToleranceOracle("o",1,absolute_tolerance=1).evaluate([math.nan]))
def test_interval_and_representativeness_boundary():
 r=m.StatisticalToleranceOracle("o",1,absolute_tolerance=1).evaluate([1,2]);assert len(r["normal_approximation_95_interval"])==2 and r["population_representativeness_proven"] is False
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} statistical-tolerance-oracle tests")
if __name__=="__main__":run()
