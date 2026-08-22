from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'long_term_proof_migrator.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.long_term_proof_migrator', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

import hashlib
M=MODULE.LongTermProofMigrator()
def step(out=b"new",**kw):
    base={"step_id":"s1","from_schema":"v1","to_schema":"v2","operation":"schema-map","input_sha256":hashlib.sha256(b"old").hexdigest(),"output_sha256":hashlib.sha256(out).hexdigest()};base.update(kw);return base
def test_valid_lineage_passes():assert M.migrate(b"old",b"new","v1","v2",[step()])["verdict_state"]=="PASS"
def test_original_bytes_preserved():assert M.migrate(b"old",b"new","v1","v2",[step()])["original_bytes"]==b"old"
def test_broken_input_hash_refused():raises(MODULE.LongTermProofMigrationError,lambda:M.migrate(b"old",b"new","v1","v2",[step(input_sha256="0"*64)]))
def test_wrong_final_hash_refused():raises(MODULE.LongTermProofMigrationError,lambda:M.migrate(b"old",b"new","v1","v2",[step(output_sha256="0"*64)]))
def test_wrong_target_refused():raises(MODULE.LongTermProofMigrationError,lambda:M.migrate(b"old",b"new","v1","v3",[step()]))
def test_duplicate_step_refused():
    s1=step(out=b"mid",to_schema="v1b");s2={"step_id":"s1","from_schema":"v1b","to_schema":"v2","operation":"copy","input_sha256":s1["output_sha256"],"output_sha256":hashlib.sha256(b"new").hexdigest()};raises(MODULE.LongTermProofMigrationError,lambda:M.migrate(b"old",b"new","v1","v2",[s1,s2]))
def test_empty_lineage_refused():raises(MODULE.LongTermProofMigrationError,lambda:M.migrate(b"old",b"new","v1","v2",[]))
def test_same_schema_refused():raises(MODULE.LongTermProofMigrationError,lambda:M.migrate(b"old",b"new","v1","v1",[step()]))
def test_packet_digest_deterministic():assert M.migrate(b"old",b"new","v1","v2",[step()])["packet_sha256"]==M.migrate(b"old",b"new","v1","v2",[step()])["packet_sha256"]
def test_boundary_truth():
    out=M.migrate(b"old",b"new","v1","v2",[step()]);assert out["migration_executed"] is False and out["signature_validity_reestablished"] is False and out["canon"] is False

def run():
    tests=[value for name,value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:test()
    print(f"PASS {len(tests)} long-term-proof-migrator tests")
if __name__=="__main__":run()
