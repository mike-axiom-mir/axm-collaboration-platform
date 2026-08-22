from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'benchmark_contract_builder.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.benchmark_contract_builder', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

B=MODULE.BenchmarkContractBuilder()
def good(**kw):
    data=dict(goal="compare latency",population="declared devices",tasks=["cold-start"],metrics=[{"name":"latency","direction":"LOWER_BETTER","unit":"ms","aggregation":"MEDIAN"}],environment={"os":"test"},exclusions=["unsupported"],stopping_rules=["3 repeats"],valid_conclusions=["relative latency only"]);data.update(kw);return data
def test_builds_contract():assert B.build(**good())["benchmark_executed"] is False
def test_id_deterministic():assert B.build(**good())["contract_id"]==B.build(**good())["contract_id"]
def test_empty_goal_refused():raises(MODULE.BenchmarkContractError,lambda:B.build(**good(goal="")))
def test_duplicate_task_refused():raises(MODULE.BenchmarkContractError,lambda:B.build(**good(tasks=["a","a"])))
def test_missing_metrics_refused():raises(MODULE.BenchmarkContractError,lambda:B.build(**good(metrics=[])))
def test_duplicate_metric_refused():raises(MODULE.BenchmarkContractError,lambda:B.build(**good(metrics=[good()["metrics"][0],good()["metrics"][0]])))
def test_bad_direction_refused():raises(MODULE.BenchmarkContractError,lambda:B.build(**good(metrics=[{"name":"x","direction":"BEST","unit":"u","aggregation":"MEAN"}])))
def test_empty_environment_refused():raises(MODULE.BenchmarkContractError,lambda:B.build(**good(environment={})))
def test_valid_conclusions_preserved():assert B.build(**good())["valid_conclusions"]==["relative latency only"]
def test_no_universal_score():
    out=B.build(**good());assert out["universal_score"] is None and out["canon"] is False

def run():
    tests=[value for name,value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:test()
    print(f"PASS {len(tests)} benchmark-contract-builder tests")
if __name__=="__main__":run()
