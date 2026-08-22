from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "resource_thermal_battery_proof.py"
SPEC = importlib.util.spec_from_file_location("resource_thermal_battery_proof", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Proof=MODULE.ResourceThermalBatteryProof();H={"hardware_id":"pc","model":"x"};W={"workload_id":"play","required_duration_s":60};T=[{"metric":"cpu_percent","aggregation":"max","direction":"max","threshold":90,"unit":"%"},{"metric":"battery_drain_per_hour","aggregation":"max","direction":"max","threshold":30,"unit":"%/h"}];S=[{"timestamp_s":0,"metrics":{"cpu_percent":50,"battery_percent":100}},{"timestamp_s":60,"metrics":{"cpu_percent":70,"battery_percent":99.5}}]
def test_valid_passes():assert Proof.verify(H,W,T,S)['verdict_state']=="PASS"
def test_cpu_violation_fails():assert Proof.verify(H,W,T,[S[0],{"timestamp_s":60,"metrics":{"cpu_percent":95,"battery_percent":99.5}}])['verdict_state']=="FAIL"
def test_battery_violation_fails():assert Proof.verify(H,W,T,[S[0],{"timestamp_s":60,"metrics":{"cpu_percent":70,"battery_percent":90}}])['verdict_state']=="FAIL"
def test_short_duration_unknown():assert Proof.verify(H,{**W,"required_duration_s":120},T,S)['verdict_state']=="UNKNOWN"
def test_missing_metric_unknown():assert Proof.verify(H,W,[{"metric":"gpu_percent","aggregation":"max","direction":"max","threshold":90}],S)['verdict_state']=="UNKNOWN"
def test_mean_aggregation():assert Proof.verify(H,W,[{"metric":"cpu_percent","aggregation":"mean","direction":"max","threshold":60}],S)['verdict_state']=="PASS"
def test_min_direction():assert Proof.verify(H,W,[{"metric":"cpu_percent","aggregation":"min","direction":"min","threshold":40}],S)['verdict_state']=="PASS"
def test_unordered_refused():raises(MODULE.ResourceProofError,lambda:Proof.verify(H,W,T,[S[1],S[0]]))
def test_duplicate_threshold_refused():raises(MODULE.ResourceProofError,lambda:Proof.verify(H,W,T+T[:1],S))
def test_boundary_truth():
    result=Proof.verify(H,W,T,S);assert result['does_not_read_sensors'] and result['samples_are_caller_supplied'] and result['hardware_identity_attested'] is False and result['canon'] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} resource-thermal-battery-proof tests")

if __name__ == "__main__":
    run()
