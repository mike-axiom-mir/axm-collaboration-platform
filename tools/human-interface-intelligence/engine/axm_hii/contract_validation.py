from __future__ import annotations

import importlib.util
from functools import lru_cache
from typing import Any

from .util import CONTRACT_ROOT


@lru_cache(maxsize=1)
def _shared_validator_module():
    validator_path = CONTRACT_ROOT / "validators" / "validate.py"
    spec = importlib.util.spec_from_file_location("axm_shared_contract_validate", validator_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load shared validator from {validator_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def validate_contract_record(instance: dict[str, Any], kind: str) -> dict[str, Any]:
    return _shared_validator_module().validate_instance(instance, kind)


def ensure_valid_capability(instance: Any) -> dict[str, Any]:
    if not isinstance(instance, dict):
        raise ValueError("Invalid capability record; capability must be an object.")
    report = validate_contract_record(instance, "capability")
    if not report["valid"]:
        details = "; ".join(
            f"{item.get('path', '/')}: {item.get('message', 'invalid')}"
            for item in report.get("errors", [])[:12]
        )
        raise ValueError(f"Invalid capability record; shared contract validation failed. {details}")
    return report
