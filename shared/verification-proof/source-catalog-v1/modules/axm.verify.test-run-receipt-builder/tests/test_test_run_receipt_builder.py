from pathlib import Path
import importlib.util, sys
P=Path(__file__).parents[1]/"src"/"test_run_receipt_builder.py";s=importlib.util.spec_from_file_location("test_run_receipt_builder",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError

def base(**changes):
 d=dict(run_id="r1",subject_ids=["a"],environment={"os":"x"},operations=[{"operation_id":"o1","kind":"TEST"}],inputs={"x":1},outputs={"ok":True},verdict_state="PASS")
 d.update(changes);return d

def test_build_and_verify():
 b=m.TestRunReceiptBuilder("b");r=b.build(**base());assert b.verify(r)
def test_deterministic_seal():
 b=m.TestRunReceiptBuilder("b");assert b.build(**base())["receipt_sha256"]==b.build(**base())["receipt_sha256"]
def test_tamper_detected():
 b=m.TestRunReceiptBuilder("b");r=b.build(**base());r["outputs"]["ok"]=False;assert not b.verify(r)
def test_distinct_verdict_preserved():
 r=m.TestRunReceiptBuilder("b").build(**base(verdict_state="CONFLICTED"));assert r["verdict_state"]=="CONFLICTED"
def test_invalid_verdict_refused():raises(m.TestRunReceiptError,lambda:m.TestRunReceiptBuilder("b").build(**base(verdict_state="MAYBE")))
def test_invalid_digest_refused():raises(m.TestRunReceiptError,lambda:m.TestRunReceiptBuilder("b").build(**base(artifact_digests={"x":"bad"})))
def test_time_order_refused():raises(m.TestRunReceiptError,lambda:m.TestRunReceiptBuilder("b").build(**base(started_at="2026-01-02T00:00:00Z",finished_at="2026-01-01T00:00:00Z")))
def test_requires_subject():raises(m.TestRunReceiptError,lambda:m.TestRunReceiptBuilder("b").build(**base(subject_ids=[])))
def test_limits_and_digests_recorded():
 r=m.TestRunReceiptBuilder("b").build(**base(limitations=["bounded"],artifact_digests={"x":"A"*64}));assert r["limitations"]==["bounded"] and r["artifact_sha256"]["x"]=="a"*64
def test_boundary_no_execution_or_authority():
 r=m.TestRunReceiptBuilder("b").build(**base());assert r["operations_executed_by_builder"] is False and r["authority"]=="NONE" and r["canon"] is False

def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} test-run-receipt-builder tests")
if __name__=="__main__":run()
