from pathlib import Path
import importlib.util,sys,json
P=Path(__file__).parents[1]/"src"/"golden_fixture_registry.py";s=importlib.util.spec_from_file_location("golden_fixture_registry",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def reg():
 r=m.GoldenFixtureRegistry("r");r.register("f","EDGE",b"abc","synthetic",["claim.a"],"human:x","receipt:x");return r
def test_register_digest():assert reg().get("f")["sha256"]==__import__("hashlib").sha256(b"abc").hexdigest()
def test_verify_pass():assert reg().verify_payload("f",b"abc")["verdict_state"]=="PASS"
def test_verify_tamper_fail():assert reg().verify_payload("f",b"abd")["verdict_state"]=="FAIL"
def test_duplicate_refused():
 r=reg();raises(m.GoldenFixtureError,lambda:r.register("f","EDGE",b"x","p",["c"],"h","rr"))
def test_category_refused():raises(m.GoldenFixtureError,lambda:m.GoldenFixtureRegistry("r").register("f","OTHER",b"x","p",["c"],"h","rr"))
def test_payload_type_refused():raises(m.GoldenFixtureError,lambda:m.GoldenFixtureRegistry("r").register("f","EDGE","x","p",["c"],"h","rr"))
def test_claims_required():raises(m.GoldenFixtureError,lambda:m.GoldenFixtureRegistry("r").register("f","EDGE",b"x","p",[],"h","rr"))
def test_get_returns_copy():
 r=reg();x=r.get("f");x["category"]="VALID";assert r.get("f")["category"]=="EDGE"
def test_filter_category():
 r=reg();r.register("g","VALID",b"x","p",["c"],"h","rr");assert [x["fixture_id"] for x in r.list("VALID")]==["g"]
def test_manifest_no_payload_or_authority():
 x=reg().export_manifest();assert x["payloads_embedded"] is False and x["authority"]=="NONE" and x["canon"] is False
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} golden-fixture-registry tests")
if __name__=="__main__":run()
