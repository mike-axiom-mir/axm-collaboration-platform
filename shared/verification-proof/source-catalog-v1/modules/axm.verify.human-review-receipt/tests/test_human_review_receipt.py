from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "human_review_receipt.py"
SPEC = importlib.util.spec_from_file_location("axm.verify.human_review_receipt", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
B=MODULE.HumanReviewReceiptBuilder()
def review():return {"review_id":"r1","reviewer_id":"human1","reviewer_role":"accessibility reviewer","artifact_id":"a1","artifact_digest":"sha256:abc","native_surface":"device-screen","inspected_scope":["keyboard flow"],"decision":"NEEDS_CHANGES","limitations":["one device"],"dissent":["contrast uncertain"],"authority_scope":["human usability evidence"],"reviewed_at":"2026-07-27T19:00:00+00:00"}
def test_receipt_built():assert B.build(review())["decision"]=="NEEDS_CHANGES"
def test_digest_deterministic():assert B.build(review())["receipt_digest"]==B.build(review())["receipt_digest"]
def test_scope_preserved():assert B.build(review())["inspected_scope"]==["keyboard flow"]
def test_dissent_preserved():assert B.build(review())["dissent"]==["contrast uncertain"]
def test_unknown_decision_refused():
    x=review();x["decision"]="PASS";raises(MODULE.HumanReviewReceiptError,lambda:B.build(x))
def test_missing_digest_refused():
    x=review();x["artifact_digest"]="";raises(MODULE.HumanReviewReceiptError,lambda:B.build(x))
def test_empty_scope_refused():
    x=review();x["inspected_scope"]=[];raises(MODULE.HumanReviewReceiptError,lambda:B.build(x))
def test_invalid_time_refused():
    x=review();x["reviewed_at"]="today";raises(MODULE.HumanReviewReceiptError,lambda:B.build(x))
def test_approval_is_evidence_only():
    x=review();x["decision"]="APPROVE";o=B.build(x);assert o["evidence_only"] is True and o["release_authority"] is False
def test_no_canon():assert B.build(review())["canon"] is False

def run():
    tests=[v for n,v in sorted(globals().items()) if n.startswith("test_") and callable(v)]
    for t in tests:t()
    print(f"PASS {len(tests)} human-review-receipt tests")
if __name__=="__main__":run()
