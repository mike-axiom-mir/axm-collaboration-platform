from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "release_gate_decision_packet.py"
SPEC = importlib.util.spec_from_file_location("axm.verify.release_gate_decision_packet", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
B=MODULE.ReleaseGateDecisionPacketBuilder()
def req():return {"artifact":{"artifact_id":"a1","digest":"sha256:abc"},"required_receipt_ids":["r1"],"receipts":[{"receipt_id":"r1","verdict_state":"PASS","fresh":True}],"unresolved_conflicts":[],"failed_checks":[],"limitations":["device scope"],"required_approval_roles":["steward"],"approvals":[{"role":"steward","decision":"APPROVE"}],"rollback_plan":{"plan_id":"rb1","verified":True}}
def test_ready_packet():assert B.assemble(req())["packet_state"]=="READY_FOR_MERGE_GATE_REVIEW"
def test_missing_receipt_blocks():
    x=req();x["receipts"]=[];assert B.assemble(x)["packet_state"]=="BLOCKED"
def test_stale_receipt_blocks():
    x=req();x["receipts"][0]["fresh"]=False;assert B.assemble(x)["blocking_reasons"][0]["code"]=="MISSING_OR_UNACCEPTABLE_RECEIPTS"
def test_conflict_blocks():
    x=req();x["unresolved_conflicts"]=["c1"];assert any(b["code"]=="UNRESOLVED_CONFLICTS" for b in B.assemble(x)["blocking_reasons"])
def test_failed_check_blocks():
    x=req();x["failed_checks"]=["t1"];assert B.assemble(x)["packet_state"]=="BLOCKED"
def test_missing_role_blocks():
    x=req();x["approvals"]=[];assert any(b["code"]=="MISSING_APPROVAL_ROLES" for b in B.assemble(x)["blocking_reasons"])
def test_unverified_rollback_blocks():
    x=req();x["rollback_plan"]["verified"]=False;assert any(b["code"]=="ROLLBACK_NOT_VERIFIED" for b in B.assemble(x)["blocking_reasons"])
def test_duplicate_receipt_refused():
    x=req();x["receipts"]*=2;raises(MODULE.ReleaseGatePacketError,lambda:B.assemble(x))
def test_exact_artifact_required():
    x=req();x["artifact"]={};raises(MODULE.ReleaseGatePacketError,lambda:B.assemble(x))
def test_never_releases_or_decides():
    o=B.assemble(req());assert o["merge_gate_decision"]=="NOT_MADE" and o["release_applied"] is False and o["canon"] is False

def run():
    tests=[v for n,v in sorted(globals().items()) if n.startswith("test_") and callable(v)]
    for t in tests:t()
    print(f"PASS {len(tests)} release-gate-decision-packet tests")
if __name__=="__main__":run()
