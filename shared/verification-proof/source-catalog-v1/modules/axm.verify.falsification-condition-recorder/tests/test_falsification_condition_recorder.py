from pathlib import Path
from tempfile import TemporaryDirectory
import importlib.util
import sys

MODULE_PATH = Path(__file__).parents[1] / "src" / "falsification_condition_recorder.py"
spec = importlib.util.spec_from_file_location("falsification_condition_recorder", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)

def expect_raises(exc_type, fn):
    try:
        fn()
    except exc_type:
        return
    raise AssertionError(f"expected {exc_type.__name__}")

def condition(cid="f1"):
    return {
        "condition_id": cid,
        "claim_id": "c1",
        "observation": "The seat identity changes.",
        "effect": "DISPROVE",
        "proof_surface": "interaction-replay",
        "scope": {"mode": "local"},
        "owner": "human",
        "recording_phase": "PRE_TEST",
        "test_state_at_recording": "NOT_RUN",
    }

def test_record_and_snapshot():
    with TemporaryDirectory() as temp:
        recorder = mod.FalsificationConditionRecorder(Path(temp) / "conditions.jsonl")
        stored = recorder.record(condition())
        assert stored["observation_status"] == "NOT_OBSERVED"
        assert recorder.snapshot()["condition_count"] == 1

def test_duplicate_refused_without_rewrite():
    with TemporaryDirectory() as temp:
        path = Path(temp) / "conditions.jsonl"
        recorder = mod.FalsificationConditionRecorder(path)
        recorder.record(condition())
        before = path.read_bytes()
        expect_raises(mod.DuplicateConditionError, lambda: recorder.record(condition()))
        assert path.read_bytes() == before

def test_post_test_record_refused():
    bad = condition()
    bad["recording_phase"] = "POST_TEST"
    expect_raises(mod.FalsificationRecorderError, lambda: mod.validate_condition(bad))

def test_non_not_run_state_refused():
    bad = condition()
    bad["test_state_at_recording"] = "PASS"
    expect_raises(mod.FalsificationRecorderError, lambda: mod.validate_condition(bad))

def test_weaken_preserved_distinct():
    item = condition()
    item["effect"] = "WEAKEN"
    assert mod.validate_condition(item)["effect"] == "WEAKEN"

def test_invalid_effect_refused():
    bad = condition()
    bad["effect"] = "MAYBE"
    expect_raises(mod.FalsificationRecorderError, lambda: mod.validate_condition(bad))

def test_empty_scope_refused():
    bad = condition()
    bad["scope"] = {}
    expect_raises(mod.FalsificationRecorderError, lambda: mod.validate_condition(bad))

def test_timing_is_caller_attested():
    assert mod.validate_condition(condition())["timing_basis"] == "CALLER_ATTESTED"

def test_snapshot_does_not_claim_observation():
    with TemporaryDirectory() as temp:
        recorder = mod.FalsificationConditionRecorder(Path(temp) / "conditions.jsonl")
        recorder.record(condition())
        assert recorder.snapshot()["observed_counterevidence_count"] == 0

def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
    print(f"PASS {len(tests)} falsification-condition-recorder tests")

if __name__ == "__main__":
    run()
