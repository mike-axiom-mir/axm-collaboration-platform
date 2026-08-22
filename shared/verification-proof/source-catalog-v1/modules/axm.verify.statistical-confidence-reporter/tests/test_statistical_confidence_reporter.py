from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'statistical_confidence_reporter.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.statistical_confidence_reporter', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

R=MODULE.StatisticalConfidenceReporter()
def test_two_samples_pass():assert R.report([1,2])["verdict_state"]=="PASS"
def test_single_sample_unknown():assert R.report([1])["verdict_state"]=="UNKNOWN"
def test_missing_counted():assert R.report([1,None,2])["candidate"]["missing"]==1
def test_mean_reported():assert R.report([1,2,3])["candidate"]["mean"]==2
def test_variance_reported():assert R.report([1,2,3])["candidate"]["variance"]==1
def test_interval_reported():assert len(R.report([1,2,3])["candidate"]["normal_approx_interval"])==2
def test_effect_size_raw():assert R.report([3,4],[1,2])["effect_size"]["raw_mean_difference"]==2
def test_nan_refused():raises(MODULE.StatisticalConfidenceError,lambda:R.report([float("nan")]))
def test_bad_z_refused():raises(MODULE.StatisticalConfidenceError,lambda:R.report([1,2],z_value=0))
def test_assumptions_visible():
    out=R.report([1,2]);assert out["outlier_policy"]=="FLAG_ONLY" and out["false_precision_avoided"] is True and out["canon"] is False

def run():
    tests=[value for name,value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:test()
    print(f"PASS {len(tests)} statistical-confidence-reporter tests")
if __name__=="__main__":run()
