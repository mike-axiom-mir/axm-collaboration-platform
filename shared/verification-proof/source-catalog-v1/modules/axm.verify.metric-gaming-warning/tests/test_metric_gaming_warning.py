from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'metric_gaming_warning.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.metric_gaming_warning', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

W=MODULE.MetricGamingWarning()
def metric(**kw):
    x={"name":"accuracy","proxy_for":"helpfulness","weight":1.0,"bounded":True,"direct_goal_link":True};x.update(kw);return x
def types(out):return {x["type"] for x in out["warnings"]}
def test_clean_contract_low_risk():assert W.assess("helpfulness",[metric()], ["safety"],"LOW")["risk_level"]=="MEDIUM"  # single metric concentration remains
def test_proxy_gap_warns():assert "PROXY_GOAL_GAP" in types(W.assess("safety",[metric(direct_goal_link=False)], ["harm"]));
def test_no_guardrails_warns():assert "NO_GUARDRAILS" in types(W.assess("helpfulness",[metric()], []))
def test_high_pressure_unbounded_warns():assert "UNBOUNDED_HIGH_PRESSURE_METRIC" in types(W.assess("helpfulness",[metric(bounded=False)], ["x"],"HIGH"))
def test_threshold_cliff_warns():assert "THRESHOLD_CLIFF_RISK" in types(W.assess("helpfulness",[metric(threshold=0.9)], ["x"]))
def test_concentration_warns():assert "METRIC_CONCENTRATION" in types(W.assess("helpfulness",[metric()], ["x"]))
def test_diverse_metrics_can_avoid_concentration():
    m1=metric(name="a",weight=.5);m2=metric(name="b",weight=.5);assert "METRIC_CONCENTRATION" not in types(W.assess("helpfulness",[m1,m2],["x"]))
def test_duplicate_metric_refused():raises(MODULE.MetricGamingError,lambda:W.assess("g",[metric(name="a"),metric(name="a")],["x"]))
def test_bad_pressure_refused():raises(MODULE.MetricGamingError,lambda:W.assess("g",[metric()],[],"MAX"))
def test_warning_not_observation():
    out=W.assess("helpfulness",[metric()], ["x"]);assert out["gaming_observed"] is False and out["goal_quality_proven"] is False and out["canon"] is False

def run():
    tests=[value for name,value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:test()
    print(f"PASS {len(tests)} metric-gaming-warning tests")
if __name__=="__main__":run()
