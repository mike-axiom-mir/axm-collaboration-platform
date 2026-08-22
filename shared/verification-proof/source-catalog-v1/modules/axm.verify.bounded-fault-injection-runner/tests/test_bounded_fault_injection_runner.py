from pathlib import Path
import importlib.util
import sys

SOURCE = Path(__file__).parents[1] / "src" / "bounded_fault_injection_runner.py"
SPEC = importlib.util.spec_from_file_location("bounded_fault_injection_runner", SOURCE)
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def raises(error, operation):
    try:
        operation()
    except error:
        return
    raise AssertionError(f"expected {error.__name__}")

Runner = MODULE.BoundedFaultInjectionRunner()
def ok(_): return {"outcome":"PASS", "recovery_observed":True}
def test_all_pass(): assert Runner.run([{"fault_id":"f1","fault_type":"NETWORK"}], ok)["verdict_state"] == "PASS"
def test_operation_failure(): assert Runner.run([{"fault_id":"f1","fault_type":"STORAGE"}], lambda _: {"outcome":"FAIL","recovery_observed":True})["verdict_state"] == "FAIL"
def test_recovery_failure(): assert Runner.run([{"fault_id":"f1","fault_type":"PROCESS"}], lambda _: {"outcome":"PASS","recovery_observed":False})["verdict_state"] == "FAIL"
def test_exception_unknown(): assert Runner.run([{"fault_id":"f1","fault_type":"CLOCK"}], lambda _: 1/0)["verdict_state"] == "UNKNOWN"
def test_case_ceiling_truncates():
    result=Runner.run([{"fault_id":"f1","fault_type":"NETWORK"},{"fault_id":"f2","fault_type":"NETWORK"}],ok,max_cases=1)
    assert result["truncated"] and result["executed_case_count"] == 1
def test_abort_ceiling():
    result=Runner.run([{"fault_id":str(i),"fault_type":"RESOURCE"} for i in range(4)],lambda _:{"outcome":"ERROR"},abort_after_failures=2)
    assert result["aborted"] and result["executed_case_count"] == 2
def test_duplicate_refused(): raises(MODULE.FaultInjectionError,lambda:Runner.run([{"fault_id":"x","fault_type":"CLOCK"},{"fault_id":"x","fault_type":"CLOCK"}],ok))
def test_bad_type_refused(): raises(MODULE.FaultInjectionError,lambda:Runner.run([{"fault_id":"x","fault_type":"MAGIC"}],ok))
def test_bad_executor_result_becomes_error(): assert Runner.run([{"fault_id":"x","fault_type":"DEPENDENCY"}],lambda _: "bad")["counts"]["ERROR"] == 1
def test_boundary_flags():
    result=Runner.run([{"fault_id":"x","fault_type":"DEPENDENCY"}],ok)
    assert result["host_level_faults_injected_by_module"] is False and result["authority"] == "NONE" and result["canon"] is False


def run():
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"PASS {len(tests)} bounded-fault-injection-runner tests")

if __name__ == "__main__":
    run()
