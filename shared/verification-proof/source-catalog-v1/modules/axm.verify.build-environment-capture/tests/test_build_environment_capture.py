from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / 'build_environment_capture.py'
SPEC = importlib.util.spec_from_file_location('build_environment_capture', SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Capture=MODULE.BuildEnvironmentCapture();ARGS=({"name":"python","version":"3.13"},{"name":"linux","version":"x"},"x86_64",[{"name":"gcc","version":"1"}],[{"name":"lib","version":"2"}],{"MODE":"release","TOKEN":"secret"},{"timezone":"UTC"},{"working_directory":"/work"})
def test_capture_builds_digest():assert Capture.capture(*ARGS)["environment_digest"].startswith("sha256:")
def test_secret_is_redacted():assert Capture.capture(*ARGS,secret_keys=["TOKEN"])["environment"]["variables"]["TOKEN"]=="<REDACTED>"
def test_secret_value_not_affect_digest():
    a=Capture.capture(*ARGS,secret_keys=["TOKEN"]);args=list(ARGS);args[5]={**ARGS[5],"TOKEN":"other"};b=Capture.capture(*args,secret_keys=["TOKEN"]);assert a["environment_digest"]==b["environment_digest"]
def test_tool_order_is_stable():
    args=list(ARGS);args[3]=[{"name":"z","version":"1"},{"name":"a","version":"2"}];a=Capture.capture(*args);args[3]=list(reversed(args[3]));assert a["environment_digest"]==Capture.capture(*args)["environment_digest"]
def test_environment_change_changes_digest():
    args=list(ARGS);args[2]="arm64";assert Capture.capture(*args)["environment_digest"]!=Capture.capture(*ARGS)["environment_digest"]
def test_duplicate_tool_refused():raises(MODULE.EnvironmentCaptureError,lambda:Capture.capture(ARGS[0],ARGS[1],ARGS[2],ARGS[3]+ARGS[3],*ARGS[4:]))
def test_duplicate_dependency_refused():raises(MODULE.EnvironmentCaptureError,lambda:Capture.capture(*ARGS[:4],ARGS[4]+ARGS[4],*ARGS[5:]))
def test_missing_runtime_refused():raises(MODULE.EnvironmentCaptureError,lambda:Capture.capture({},*ARGS[1:]))
def test_bad_secret_key_refused():raises(MODULE.EnvironmentCaptureError,lambda:Capture.capture(*ARGS,secret_keys=[""]))
def test_boundary_truth():
    result=Capture.capture(*ARGS,secret_keys=["TOKEN"]);assert result["host_inspection_performed"] is False and result["secret_values_retained"] is False and result["completeness_proven"] is False and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} build-environment-capture tests")

if __name__ == "__main__":
    run()
