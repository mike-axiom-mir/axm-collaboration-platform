from pathlib import Path
import importlib.util, sys
P=Path(__file__).parents[1]/"src"/"composite_native_human_oracle.py";s=importlib.util.spec_from_file_location("composite_native_human_oracle",P);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
def raises(e,f):
 try:f()
 except e:return
 raise AssertionError
def seat(i,a,v="PASS",sub="artifact",scope="scope",ind=True):return m.EvidenceSeat(i,sub,scope,a,v,"receipt:"+i,ind)
def test_all_required_pass():
 o=m.CompositeNativeHumanOracle("r",["SPECIALIST_TECHNICAL","NATIVE_VISUAL"]);assert o.resolve([seat("a","SPECIALIST_TECHNICAL"),seat("b","NATIVE_VISUAL")])["verdict_state"]=="PASS"
def test_missing_is_unknown():assert m.CompositeNativeHumanOracle("r",["NATIVE_VISUAL"]).resolve([seat("a","SPECIALIST_TECHNICAL")])["reason"]=="MISSING_REQUIRED_AUTHORITY"
def test_pass_fail_conflict():
 r=m.CompositeNativeHumanOracle("r",["SPECIALIST_TECHNICAL","NATIVE_VISUAL"]).resolve([seat("a","SPECIALIST_TECHNICAL"),seat("b","NATIVE_VISUAL","FAIL")]);assert r["verdict_state"]=="CONFLICTED"
def test_only_fail_is_fail():assert m.CompositeNativeHumanOracle("r",["NATIVE_VISUAL"]).resolve([seat("a","NATIVE_VISUAL","FAIL")])["verdict_state"]=="FAIL"
def test_human_review_preserved():assert m.CompositeNativeHumanOracle("r",["HUMAN_JUDGMENT"]).resolve([seat("a","HUMAN_JUDGMENT","HUMAN_REVIEW")])["verdict_state"]=="HUMAN_REVIEW"
def test_stale_is_unknown():assert m.CompositeNativeHumanOracle("r",["NATIVE_VISUAL"]).resolve([seat("a","NATIVE_VISUAL","STALE")])["verdict_state"]=="UNKNOWN"
def test_independence_gate():assert m.CompositeNativeHumanOracle("r",["NATIVE_VISUAL"],True).resolve([seat("a","NATIVE_VISUAL",ind=False)])["reason"]=="INDEPENDENCE_REQUIREMENT_UNMET"
def test_scope_mismatch_refused():raises(m.CompositeOracleError,lambda:m.CompositeNativeHumanOracle("r",["NATIVE_VISUAL"]).resolve([seat("a","NATIVE_VISUAL",scope="x"),seat("b","NATIVE_VISUAL",scope="y")]))
def test_duplicate_seat_refused():raises(m.CompositeOracleError,lambda:m.CompositeNativeHumanOracle("r",["NATIVE_VISUAL"]).resolve([seat("a","NATIVE_VISUAL"),seat("a","NATIVE_VISUAL")]))
def test_no_score_or_authority():
 r=m.CompositeNativeHumanOracle("r",["NATIVE_VISUAL"]).resolve([seat("a","NATIVE_VISUAL")]);assert r["universal_score"] is None and r["authority"]=="NONE" and r["canon"] is False
def run():
 t=[v for n,v in sorted(globals().items()) if n.startswith("test_")];[x() for x in t];print(f"PASS {len(t)} composite-native-human-oracle tests")
if __name__=="__main__":run()
