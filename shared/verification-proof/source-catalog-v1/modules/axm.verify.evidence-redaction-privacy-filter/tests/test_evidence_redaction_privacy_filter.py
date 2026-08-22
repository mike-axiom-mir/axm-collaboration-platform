from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'evidence_redaction_privacy_filter.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.evidence_redaction_privacy_filter', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
F=MODULE.EvidenceRedactionPrivacyFilter()
def test_exact_keep_under_default_drop():assert F.filter({"id":"x","secret":"y"},[{"path":"/id","action":"keep"}])["redacted_evidence"]=={"id":"x"}
def test_drop_removes_field():assert F.filter({"a":1,"b":2},[{"path":"/a","action":"drop"}],"keep")["redacted_evidence"]=={"b":2}
def test_mask_replaces_value():assert F.filter({"secret":"x"},[{"path":"/secret","action":"mask","replacement":"redacted"}])["redacted_evidence"]["secret"]=="redacted"
def test_hash_is_deterministic():assert F.filter({"x":"a"},[{"path":"/x","action":"hash"}])["redacted_evidence"]["x"]==F.filter({"x":"a"},[{"path":"/x","action":"hash"}])["redacted_evidence"]["x"]
def test_generalize_text_hides_text():assert F.filter({"x":"abcd"},[{"path":"/x","action":"generalize"}])["redacted_evidence"]["x"]=={"type":"text","length":4}
def test_wildcard_rule_applies():assert F.filter({"people":[{"email":"a"},{"email":"b"}]},[{"path":"/people/*/email","action":"mask"}])["redacted_evidence"]["people"][1]["email"]=="***"
def test_default_drop_removes_unruled_leaf():assert F.filter({"a":1},[])["redacted_evidence"]=={}
def test_required_path_loss_refused():raises(MODULE.EvidenceRedactionError,lambda:F.filter({"id":"x"},[],required_paths=["/id"]))
def test_invalid_rule_refused():raises(MODULE.EvidenceRedactionError,lambda:F.filter({"x":1},[{"path":"x","action":"keep"}]))
def test_boundary_truth():
    out=F.filter({"id":"x"},[{"path":"/id","action":"keep"}]);assert out["secret_detection_performed"] is False and out["privacy_sufficiency_proven"] is False and out["canon"] is False
def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} evidence-redaction-privacy-filter tests")

if __name__ == "__main__":
    run()
