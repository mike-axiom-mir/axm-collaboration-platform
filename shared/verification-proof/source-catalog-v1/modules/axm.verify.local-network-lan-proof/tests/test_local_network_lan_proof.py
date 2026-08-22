from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "local_network_lan_proof.py"
SPEC = importlib.util.spec_from_file_location("local_network_lan_proof", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Proof=MODULE.LocalNetworkLanProof();P={"network_id":"lan","authority_id":"host","max_latency_ms":50,"offline_required":True,"isolation_required":True};R=["discovery","authority","latency","offline","isolation"];O=[{"scenario":"discovery","status":"PASS"},{"scenario":"authority","status":"PASS","observed_authority_id":"host"},{"scenario":"latency","status":"PASS","latency_ms":20},{"scenario":"offline","status":"PASS","external_network_available":False},{"scenario":"isolation","status":"PASS","cross_network_reachable":False}]
def test_valid_passes():assert Proof.verify(P,R,O)['verdict_state']=="PASS"
def test_missing_unknown():assert Proof.verify(P,R,O[:-1])['verdict_state']=="UNKNOWN"
def test_authority_mismatch_fails():assert Proof.verify(P,R,[*O[:1],{**O[1],"observed_authority_id":"client"},*O[2:]])['verdict_state']=="FAIL"
def test_latency_fails():assert Proof.verify(P,R,[*O[:2],{**O[2],"latency_ms":80},*O[3:]])['verdict_state']=="FAIL"
def test_offline_fails():assert Proof.verify(P,R,[*O[:3],{**O[3],"external_network_available":True},O[4]])['verdict_state']=="FAIL"
def test_isolation_fails():assert Proof.verify(P,R,[*O[:4],{**O[4],"cross_network_reachable":True}])['verdict_state']=="FAIL"
def test_reported_failure_fails():assert Proof.verify(P,R,[{**O[0],"status":"FAIL"},*O[1:]])['verdict_state']=="FAIL"
def test_duplicate_scenario_refused():raises(MODULE.LanProofError,lambda:Proof.verify(P,R+R[:1],O))
def test_unknown_observation_refused():raises(MODULE.LanProofError,lambda:Proof.verify(P,R,O+[{"scenario":"pairing","status":"PASS"}]))
def test_boundary_truth():
    result=Proof.verify(P,R,O);assert result['does_not_open_sockets'] and result['observations_are_caller_supplied'] and result['network_isolation_independently_measured'] is False and result['canon'] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} local-network-lan-proof tests")

if __name__ == "__main__":
    run()
