from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'evidence_chain_of_custody_ledger.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.evidence_chain_of_custody_ledger', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
L=MODULE.EvidenceChainOfCustodyLedger()
def ev(action="CREATE",ts="2026-01-01T00:00:00Z"):return {"object_id":"e1","actor":"agent","actor_type":"AI","action":action,"timestamp":ts,"details":{"note":"x"}}
def test_first_entry_uses_zero_hash():assert L.append(ev())["previous_hash"]=="0"*64
def test_second_entry_links_first():
    l=MODULE.EvidenceChainOfCustodyLedger();a=l.append(ev());b=l.append(ev("MOVE","2026-01-01T00:00:01Z"));assert b["previous_hash"]==a["entry_hash"]
def test_valid_chain_passes():
    l=MODULE.EvidenceChainOfCustodyLedger();l.append(ev());assert l.verify()["verdict_state"]=="PASS"
def test_tamper_is_detected():
    l=MODULE.EvidenceChainOfCustodyLedger();row=l.append(ev());row["actor"]="other";assert l.verify([row])["verdict_state"]=="FAIL"
def test_timestamp_regression_refused():
    l=MODULE.EvidenceChainOfCustodyLedger();l.append(ev(ts="2026-01-02T00:00:00Z"));raises(MODULE.CustodyLedgerError,lambda:l.append(ev("MOVE","2026-01-01T00:00:00Z")))
def test_bad_action_refused():raises(MODULE.CustodyLedgerError,lambda:MODULE.EvidenceChainOfCustodyLedger().append(ev("DELETE")))
def test_missing_field_refused():raises(MODULE.CustodyLedgerError,lambda:MODULE.EvidenceChainOfCustodyLedger().append({"object_id":"x"}))
def test_input_details_are_copied():
    l=MODULE.EvidenceChainOfCustodyLedger();e=ev();row=l.append(e);e["details"]["note"]="changed";assert row["details"]["note"]=="x"
def test_empty_chain_passes():assert MODULE.EvidenceChainOfCustodyLedger().verify()["verdict_state"]=="PASS"
def test_boundary_truth():
    row=MODULE.EvidenceChainOfCustodyLedger().append({**ev(),"claimed_authority_scope":"review"});assert row["identity_authenticated_by_module"] is False and row["authority_authenticated_by_module"] is False and row["canon"] is False
def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} evidence-chain-of-custody-ledger tests")

if __name__ == "__main__":
    run()
