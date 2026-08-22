from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'offline_proof_pack_exporter.py'
SPEC = importlib.util.spec_from_file_location('axm.verify.offline_proof_pack_exporter', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")
import io,zipfile
E=MODULE.OfflineProofPackExporter()
def entry(path="a.txt",content=b"x",privacy="PASS"):return {"path":path,"content":content,"role":"receipt","privacy_status":privacy}
def test_private_pack_exports():assert E.export([entry()])["verdict_state"]=="PASS"
def test_zip_contains_manifest_and_entry():
    out=E.export([entry()]);z=zipfile.ZipFile(io.BytesIO(out["archive_bytes"]));assert z.namelist()==["MANIFEST.json","a.txt"]
def test_output_is_deterministic():assert E.export([entry()],metadata={"b":2,"a":1})["archive_bytes"]==E.export([entry()],metadata={"a":1,"b":2})["archive_bytes"]
def test_public_requires_privacy_pass():raises(MODULE.OfflineProofPackError,lambda:E.export([entry(privacy="UNKNOWN")],"PUBLIC"))
def test_private_unknown_is_visible():assert E.export([entry(privacy="UNKNOWN")],"PRIVATE")["verdict_state"]=="UNKNOWN"
def test_privacy_failure_blocks_all_modes():raises(MODULE.OfflineProofPackError,lambda:E.export([entry(privacy="FAIL")],"PRIVATE"))
def test_parent_path_refused():raises(MODULE.OfflineProofPackError,lambda:E.export([entry("../x")]))
def test_duplicate_path_refused():raises(MODULE.OfflineProofPackError,lambda:E.export([entry(),entry(content=b"y")]))
def test_byte_bound_enforced():raises(MODULE.OfflineProofPackError,lambda:E.export([entry(content=b"xx")],max_total_bytes=1))
def test_boundary_truth():
    out=E.export([entry()]);assert out["written_to_disk"] is False and out["encrypted"] is False and out["signed"] is False and out["canon"] is False
def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} offline-proof-pack-exporter tests")

if __name__ == "__main__":
    run()
