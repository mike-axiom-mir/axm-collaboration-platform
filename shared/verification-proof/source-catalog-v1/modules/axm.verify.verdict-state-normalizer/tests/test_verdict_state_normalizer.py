from pathlib import Path
import importlib.util

MODULE_PATH = Path(__file__).parents[1] / "src" / "verdict_state_normalizer.py"
import sys

spec = importlib.util.spec_from_file_location("verdict_state_normalizer", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)

def expect_raises(exc_type, fn):
    try:
        fn()
    except exc_type:
        return
    raise AssertionError(f"expected {exc_type.__name__}")

def test_exact_seven_states_remain_distinct():
    assert mod.CANONICAL_VERDICTS == (
        "PASS", "FAIL", "UNKNOWN", "NOT_RUN",
        "CONFLICTED", "STALE", "HUMAN_REVIEW"
    )
    assert len(set(mod.CANONICAL_VERDICTS)) == 7

def test_canonical_input_preserved():
    n = mod.VerdictNormalizer()
    result = n.normalize("NOT_RUN", "tool-a")
    assert result["canonical_state"] == "NOT_RUN"
    assert result["normalization_method"] == "CANONICAL_INPUT"

def test_explicit_mapping_only():
    n = mod.VerdictNormalizer({"ok":"PASS", "skipped":"NOT_RUN"})
    assert n.normalize("ok", "tool-a")["canonical_state"] == "PASS"
    assert n.normalize("skipped", "tool-a")["canonical_state"] == "NOT_RUN"

def test_unmapped_becomes_unknown_not_pass():
    n = mod.VerdictNormalizer()
    result = n.normalize("looks fine", "tool-a")
    assert result["canonical_state"] == "UNKNOWN"
    assert result["raw_state"] == "looks fine"
    assert result["requires_review"] is True

def test_invalid_mapping_refused():
    expect_raises(
        mod.VerdictNormalizationError,
        lambda: mod.VerdictNormalizer({"ok":"MOSTLY_PASS"})
    )

def test_empty_source_refused():
    n = mod.VerdictNormalizer()
    expect_raises(mod.VerdictNormalizationError, lambda: n.normalize("PASS", ""))

def test_inventory_preserves_dimensions():
    n = mod.VerdictNormalizer()
    receipts = [
        n.normalize("PASS", "a"),
        n.normalize("FAIL", "b"),
        n.normalize("STALE", "c"),
        n.normalize("mystery", "d"),
    ]
    inventory = n.state_inventory(receipts)
    assert inventory["counts"]["PASS"] == 1
    assert inventory["counts"]["FAIL"] == 1
    assert inventory["counts"]["STALE"] == 1
    assert inventory["counts"]["UNKNOWN"] == 1
    assert inventory["collapsed_score"] is None
    assert inventory["decision"] is None

def test_boolean_collapse_refused():
    n = mod.VerdictNormalizer()
    expect_raises(mod.VerdictNormalizationError, n.collapse_to_boolean)

def test_percentage_collapse_refused():
    n = mod.VerdictNormalizer()
    expect_raises(mod.VerdictNormalizationError, n.collapse_to_percentage)

def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    for test in tests:
        test()
    print(f"PASS {len(tests)} verdict-state-normalizer tests")

if __name__ == "__main__":
    run()
