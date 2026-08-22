from pathlib import Path
import importlib.util, sys, traceback

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

def main():
    passed = 0
    failed = 0
    for path in sorted(Path(__file__).parent.glob("test_*.py")):
        spec = importlib.util.spec_from_file_location(path.stem, path)
        module = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(module)
            module.run()
            print(f"PASS {path.name}")
            passed += 1
        except Exception:
            print(f"FAIL {path.name}")
            traceback.print_exc()
            failed += 1
    print(f"\nRESULT: {passed} passed, {failed} failed")
    return 1 if failed else 0

if __name__ == "__main__":
    raise SystemExit(main())
