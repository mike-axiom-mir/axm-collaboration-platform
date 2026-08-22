from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "layout_responsive_proof.py"
SPEC = importlib.util.spec_from_file_location("layout_responsive_proof", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Proof=MODULE.LayoutResponsiveProof();V=[{"viewport_id":"phone","width":360,"height":800}];P={"min_touch_px":44,"max_overflow_px":0,"min_scale":0.5,"max_scale":2};O={"viewport_id":"phone","status":"PASS","hidden_content":[],"horizontal_overflow_px":0,"touch_targets":[{"width":48,"height":48}],"expected_focus_order":["a","b"],"observed_focus_order":["a","b"],"scale":1,"expected_breakpoint":"small","observed_breakpoint":"small"}
def test_valid_passes():assert Proof.verify(V,[O],P)['verdict_state']=="PASS"
def test_missing_unknown():assert Proof.verify(V,[],P)['verdict_state']=="UNKNOWN"
def test_hidden_fails():assert Proof.verify(V,[{**O,"hidden_content":["x"]}],P)['verdict_state']=="FAIL"
def test_overflow_fails():assert Proof.verify(V,[{**O,"horizontal_overflow_px":1}],P)['verdict_state']=="FAIL"
def test_touch_fails():assert Proof.verify(V,[{**O,"touch_targets":[{"width":20,"height":48}]}],P)['verdict_state']=="FAIL"
def test_focus_fails():assert Proof.verify(V,[{**O,"observed_focus_order":["b","a"]}],P)['verdict_state']=="FAIL"
def test_scale_fails():assert Proof.verify(V,[{**O,"scale":3}],P)['verdict_state']=="FAIL"
def test_breakpoint_fails():assert Proof.verify(V,[{**O,"observed_breakpoint":"large"}],P)['verdict_state']=="FAIL"
def test_duplicate_viewport_refused():raises(MODULE.LayoutProofError,lambda:Proof.verify(V+V,[O],P))
def test_boundary_truth():
    result=Proof.verify(V,[O],P);assert result['does_not_render'] and result['observations_are_caller_supplied'] and result['authority']=="NONE" and result['canon'] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} layout-responsive-proof tests")

if __name__ == "__main__":
    run()
