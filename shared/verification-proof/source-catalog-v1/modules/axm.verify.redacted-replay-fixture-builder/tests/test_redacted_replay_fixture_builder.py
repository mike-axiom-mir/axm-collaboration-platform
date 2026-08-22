from pathlib import Path
import importlib.util,sys,json
P=Path(__file__).parents[1]/"src"/"redacted_replay_fixture_builder.py";s=importlib.util.spec_from_file_location("redacted_replay_fixture_builder",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def builder():return m.RedactedReplayFixtureBuilder("b",keep_fields=["event_type"],mask_fields=["name"],hash_fields=["user_id"],generalize_fields={"message":"LENGTH"},salt="s")
def events():return [{"timestamp":"2026-01-01T00:00:00Z","event_type":"A","name":"Mike","user_id":"u1","message":"hello","unknown":"drop"},{"timestamp":"2026-01-01T00:00:02Z","event_type":"B","user_id":"u1"}]
def test_relative_time():assert builder().build(events())["events"][1]["relative_ms"]==2000
def test_masking():assert builder().build(events())["events"][0]["name"]=="***"
def test_hash_deterministic():
 a=builder().build(events())["events"][0]["user_id_sha256"];b=builder().build(events())["events"][0]["user_id_sha256"];assert a==b and a!="u1"
def test_generalize_length():assert builder().build(events())["events"][0]["message"]["length"]==5
def test_default_drop():assert "unknown" not in builder().build(events())["events"][0]
def test_absolute_time_removed():assert "timestamp" not in builder().build(events())["events"][0]
def test_keep_sensitive_refused():raises(m.ReplayRedactionError,lambda:m.RedactedReplayFixtureBuilder("b",keep_fields=["auth_token"]))
def test_hash_without_salt_refused():raises(m.ReplayRedactionError,lambda:m.RedactedReplayFixtureBuilder("b",hash_fields=["user_id"]))
def test_overlapping_actions_refused():raises(m.ReplayRedactionError,lambda:m.RedactedReplayFixtureBuilder("b",keep_fields=["x"],drop_fields=["x"]))
def test_boundary_no_guarantee():
 r=builder().build(events());assert r["deidentification_guaranteed"] is False and r["default_action"]=="DROP" and r["canon"] is False
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} redacted-replay-fixture-builder tests")
if __name__=="__main__":run()
