from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'leakage_contamination_detector.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.leakage_contamination_detector', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

D=MODULE.LeakageContaminationDetector()
def item(i,c,meta=None):return {"id":i,"content":c,"metadata":meta or {}}
def test_no_findings_stays_unknown():assert D.detect([item("t","a")],[item("e","b")])["verdict_state"]=="UNKNOWN"
def test_id_overlap_fails():assert D.detect([item("x","a")],[item("x","b")])["verdict_state"]=="FAIL"
def test_exact_overlap_fails():assert D.detect([item("t","same")],[item("e","same")])["verdict_state"]=="FAIL"
def test_normalized_overlap_review():assert D.detect([item("t","Hello  World")],[item("e"," hello world ")])["verdict_state"]=="HUMAN_REVIEW"
def test_hidden_hint_fails():assert D.detect([], [item("e","q",{"hidden_hint":"answer"})])["verdict_state"]=="FAIL"
def test_hint_pattern_fails():assert D.detect([], [item("e","secret answer")],hint_patterns=["answer"])["verdict_state"]=="FAIL"
def test_output_match_review():assert D.detect([], [item("e","x")],[item("o","x")])["verdict_state"]=="HUMAN_REVIEW"
def test_duplicate_id_refused():raises(MODULE.LeakageDetectionError,lambda:D.detect([item("t","a"),item("t","b")],[]))
def test_bad_content_refused():raises(MODULE.LeakageDetectionError,lambda:D.detect([{"id":"t","content":1}],[]))
def test_absence_not_proof():
    out=D.detect([],[]);assert out["semantic_contamination_excluded"] is False and out["training_corpus_completeness_proven"] is False and out["canon"] is False

def run():
    tests=[value for name,value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:test()
    print(f"PASS {len(tests)} leakage-contamination-detector tests")
if __name__=="__main__":run()
