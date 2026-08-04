#!/usr/bin/env python3
"""Run the installed garden without its intentionally deduplicated ZIP packs."""

from __future__ import annotations

import os
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / "runtime"
sys.path.insert(0, str(RUNTIME))
sys.path.insert(0, str(RUNTIME / "shared"))

EXCLUDED_PACK_TEST_MODULES = {
    "test_run_44_selective_packs",
    "test_run_51_pack_upgrade",
    "test_run_75_selective_pack_v4",
    "test_run_85_selective_pack_v5",
}


def iter_tests(suite: unittest.TestSuite):
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            yield from iter_tests(item)
        else:
            yield item


def run_validator(name: str) -> None:
    environment = dict(os.environ)
    environment["PYTHONPATH"] = os.pathsep.join((str(RUNTIME), str(RUNTIME / "shared"), environment.get("PYTHONPATH", "")))
    result = subprocess.run([sys.executable, str(RUNTIME / "tools" / name)], cwd=RUNTIME, env=environment)
    if result.returncode:
        raise SystemExit(result.returncode)


def main() -> None:
    for validator in ("validate_garden.py", "verify_assurance.py", "audit_authority_surface.py"):
        run_validator(validator)

    discovered = unittest.defaultTestLoader.discover(str(RUNTIME / "tests"), pattern="test_*.py")
    selected = []
    excluded = []
    for test in iter_tests(discovered):
        module_name = test.id().split(".", 1)[0]
        if module_name in EXCLUDED_PACK_TEST_MODULES:
            excluded.append(test.id())
        else:
            selected.append(test)
    if len(selected) != 972 or len(excluded) != 32:
        raise SystemExit(f"expected 972 runtime tests and 32 deduplicated-pack tests, found {len(selected)} and {len(excluded)}")
    result = unittest.TextTestRunner(verbosity=1).run(unittest.TestSuite(selected))
    if not result.wasSuccessful():
        raise SystemExit(1)
    print("AXM TRANSLATION INSTALLED RUNTIME: PASS (972 tests; 32 pack-carrier tests retained as intake evidence)")


if __name__ == "__main__":
    main()
