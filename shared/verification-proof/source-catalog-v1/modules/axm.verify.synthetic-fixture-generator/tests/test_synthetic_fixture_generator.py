from pathlib import Path
import importlib.util,sys
P=Path(__file__).parents[1]/"src"/"synthetic_fixture_generator.py";s=importlib.util.spec_from_file_location("synthetic_fixture_generator",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def test_deterministic():
 s={"type":"array","minItems":3,"maxItems":3,"items":{"type":"integer","minimum":1,"maximum":9}};assert m.SyntheticFixtureGenerator("g",1).generate(s)["value"]==m.SyntheticFixtureGenerator("g",1).generate(s)["value"]
def test_integer_bounds():
 v=m.SyntheticFixtureGenerator("g",1).generate({"type":"integer","minimum":4,"maximum":4})["value"];assert v==4
def test_object_required_only():
 s={"type":"object","properties":{"a":{"type":"boolean"},"b":{"type":"boolean"}},"required":["a"]};assert set(m.SyntheticFixtureGenerator("g",1).generate(s)["value"])=={"a"}
def test_email_is_invalid_domain():assert m.SyntheticFixtureGenerator("g",1).generate({"type":"string","x-axm-kind":"email"})["value"].endswith("@example.invalid")
def test_secret_marked_synthetic():assert m.SyntheticFixtureGenerator("g",1).generate({"type":"string","x-axm-kind":"secret"})["value"].startswith("SYNTHETIC_SECRET_")
def test_enum_member():assert m.SyntheticFixtureGenerator("g",1).generate({"type":"string","enum":["a","b"]})["value"] in {"a","b"}
def test_source_values_refused():raises(m.SyntheticFixtureError,lambda:m.SyntheticFixtureGenerator("g",1).generate({"type":"string","source_values":["real"]}))
def test_real_data_flag_refused():raises(m.SyntheticFixtureError,lambda:m.SyntheticFixtureGenerator("g",1).generate({"type":"string","x-axm-real-data":True}))
def test_unknown_type_refused():raises(m.SyntheticFixtureError,lambda:m.SyntheticFixtureGenerator("g",1).generate({"type":"mystery"}))
def test_boundary_marks_not_representative():
 r=m.SyntheticFixtureGenerator("g",1).generate({"type":"boolean"});assert r["synthetic"] is True and r["real_personal_data_used"] is False and r["representativeness_proven"] is False
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} synthetic-fixture-generator tests")
if __name__=="__main__":run()
