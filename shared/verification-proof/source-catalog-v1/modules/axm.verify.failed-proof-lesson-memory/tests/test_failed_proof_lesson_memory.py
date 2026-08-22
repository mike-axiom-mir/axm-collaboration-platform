from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "failed_proof_lesson_memory.py"
SPEC = importlib.util.spec_from_file_location("axm.verify.failed_proof_lesson_memory", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
def record(lid="l1"):return {"lesson_id":lid,"claim_id":"c1","outcome":"FAILED_CHECK","evidence_ids":["r1"],"bounded_lesson":"timeout path failed under 1 MB disk","scope":["version 1","1 MB free disk"],"non_generalization":"does not establish failure at other disk capacities","recorded_at":"2026-07-27T19:00:00+00:00"}
def test_add_and_get():
    m=MODULE.FailedProofLessonMemory();assert m.add(record())["lesson_id"]==m.get("l1")["lesson_id"]
def test_digest_deterministic():
    a=MODULE.FailedProofLessonMemory().add(record());b=MODULE.FailedProofLessonMemory().add(record());assert a["lesson_digest"]==b["lesson_digest"]
def test_duplicate_refused():
    m=MODULE.FailedProofLessonMemory();m.add(record());raises(MODULE.FailedProofLessonError,lambda:m.add(record()))
def test_unknown_outcome_refused():
    x=record();x["outcome"]="BAD";raises(MODULE.FailedProofLessonError,lambda:MODULE.FailedProofLessonMemory().add(x))
def test_empty_evidence_refused():
    x=record();x["evidence_ids"]=[];raises(MODULE.FailedProofLessonError,lambda:MODULE.FailedProofLessonMemory().add(x))
def test_scope_preserved():assert MODULE.FailedProofLessonMemory().add(record())["scope"]==["version 1","1 MB free disk"]
def test_non_generalization_preserved():assert "other disk" in MODULE.FailedProofLessonMemory().add(record())["non_generalization"]
def test_canon_request_refused():
    x=record();x["promote_canon"]=True;raises(MODULE.FailedProofLessonError,lambda:MODULE.FailedProofLessonMemory().add(x))
def test_rule_request_refused():
    x=record();x["create_rule"]=True;raises(MODULE.FailedProofLessonError,lambda:MODULE.FailedProofLessonMemory().add(x))
def test_no_rule_or_canon():
    o=MODULE.FailedProofLessonMemory().add(record());assert o["rule_created"] is False and o["promoted_canon"] is False

def run():
    tests=[v for n,v in sorted(globals().items()) if n.startswith("test_") and callable(v)]
    for t in tests:t()
    print(f"PASS {len(tests)} failed-proof-lesson-memory tests")
if __name__=="__main__":run()
