from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "continuous_recertification_scheduler.py"
SPEC = importlib.util.spec_from_file_location("axm.verify.continuous_recertification_scheduler", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
S=MODULE.ContinuousRecertificationScheduler()
def proof(pid="p1"):return {"proof_id":pid,"expires_at":"2026-08-01T00:00:00+00:00","dependencies":{"code":["module-a"]},"verdict_state":"PASS"}
def test_not_due_empty():assert S.plan([proof()],[],"2026-07-27T00:00:00+00:00")["due_count"]==0
def test_expired_due():
    p=proof();p["expires_at"]="2026-07-01T00:00:00+00:00";assert S.plan([p],[],"2026-07-27T00:00:00+00:00")["due_proofs"][0]["reasons"]==["EXPIRY_DUE"]
def test_exact_change_invalidates():
    e={"category":"code","subject_id":"module-a","occurred_at":"2026-07-26T00:00:00+00:00"};assert S.plan([proof()],[e],"2026-07-27T00:00:00+00:00")["due_count"]==1
def test_unrelated_change_does_not_invalidate():
    e={"category":"code","subject_id":"module-b","occurred_at":"2026-07-26T00:00:00+00:00"};assert S.plan([proof()],[e],"2026-07-27T00:00:00+00:00")["due_count"]==0
def test_stale_due():
    p=proof();p["verdict_state"]="STALE";assert "ALREADY_STALE" in S.plan([p],[],"2026-07-27T00:00:00+00:00")["due_proofs"][0]["reasons"]
def test_invalidated_priority_first():
    a=proof("a");a["expires_at"]="2026-07-01T00:00:00+00:00";a["dependencies"]={"code":["module-x"]};b=proof("b");e={"category":"code","subject_id":"module-a","occurred_at":"2026-07-26T00:00:00+00:00"};assert S.plan([a,b],[e],"2026-07-27T00:00:00+00:00")["due_proofs"][0]["proof_id"]=="b"
def test_duplicate_proof_refused():raises(MODULE.RecertificationSchedulerError,lambda:S.plan([proof(),proof()],[],"2026-07-27T00:00:00+00:00"))
def test_unknown_category_refused():
    p=proof();p["dependencies"]={"magic":["x"]};raises(MODULE.RecertificationSchedulerError,lambda:S.plan([p],[],"2026-07-27T00:00:00+00:00"))
def test_invalid_time_refused():raises(MODULE.RecertificationSchedulerError,lambda:S.plan([proof()],[],"today"))
def test_no_execution_or_persistence():
    o=S.plan([proof()],[],"2026-07-27T00:00:00+00:00");assert o["execution_applied"] is False and o["schedule_persisted"] is False and o["canon"] is False

def run():
    tests=[v for n,v in sorted(globals().items()) if n.startswith("test_") and callable(v)]
    for t in tests:t()
    print(f"PASS {len(tests)} continuous-recertification-scheduler tests")
if __name__=="__main__":run()
