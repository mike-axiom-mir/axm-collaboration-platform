from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'benchmark_environment_normalizer.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.benchmark_environment_normalizer', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

N=MODULE.BenchmarkEnvironmentNormalizer()
def full(**kw):
    x={"hardware":{"cpu":"x"},"software":{"runtime":"3"},"load":{"cpu":0.2},"temperature":{"c":40},"cache_state":"cold","network":"offline","randomness":{"seed":1},"warmup":{"runs":2}};x.update(kw);return x
def test_complete_profile_passes():assert N.normalize(full())["verdict_state"]=="PASS"
def test_missing_field_unknown():assert "network" in N.normalize({k:v for k,v in full().items() if k!="network"})["missing_fields"]
def test_unknown_value_visible():assert "network" in N.normalize(full(network=""))["unknown_fields"]
def test_fingerprint_deterministic():assert N.normalize(full())["profile_sha256"]==N.normalize(dict(reversed(list(full().items()))))["profile_sha256"]
def test_secret_redacted():assert N.normalize(full(software={"runtime":"3","token":"abc"}))["normalized_profile"]["software"]["token"]=="[REDACTED]"
def test_non_mapping_refused():raises(MODULE.BenchmarkEnvironmentError,lambda:N.normalize([]))
def test_nonfinite_refused():raises(MODULE.BenchmarkEnvironmentError,lambda:N.normalize(full(load={"cpu":float("inf")})))
def test_nonstring_key_refused():raises(MODULE.BenchmarkEnvironmentError,lambda:N.normalize(full(load={1:"x"})))
def test_custom_required_fields():assert N.normalize({"hardware":"h"},required_fields=["hardware"])["verdict_state"]=="PASS"
def test_no_host_mutation_claim():
    out=N.normalize(full());assert out["host_environment_changed"] is False and out["conditions_controlled"] is False and out["canon"] is False

def run():
    tests=[value for name,value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:test()
    print(f"PASS {len(tests)} benchmark-environment-normalizer tests")
if __name__=="__main__":run()
