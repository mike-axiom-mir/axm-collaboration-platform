from __future__ import annotations

import copy
import hashlib
import json
from dataclasses import dataclass
from typing import Any, Iterable

from .util import DATA_ROOT, load_json
from .version import CONTRACT_VERSION

SKILL_ORDER = {
    "unknown": -1,
    "beginner": 0,
    "basic": 1,
    "intermediate": 2,
    "advanced": 3,
    "specialist": 4,
}

COST_ORDER = {
    "none": 0,
    "very_low": 1,
    "low": 2,
    "medium": 3,
    "high": 4,
    "very_high": 5,
    "unknown": 99,
}

REQUIRED_PATTERN_FIELDS = {
    "interface_pattern_id",
    "interface_name",
    "interface_family",
    "handles_well",
    "handles_badly",
    "minimum_user_skill",
    "attention_cost",
    "interaction_cost",
    "error_likelihood",
    "accessibility_strengths",
    "accessibility_weaknesses",
    "preview_capability",
    "reversibility_support",
    "best_input_types",
    "best_output_types",
    "beginner_suitable",
    "advanced_capability_types_requiring_another_interface",
    "selection_reasons",
    "rejection_reasons",
    "features",
    "task_affinity",
    "input_affinity",
    "output_affinity",
    "device_affinity",
    "offline_capable",
    "compute_overhead",
    "required_tool_any",
}

LIST_PATTERN_FIELDS = {
    "handles_well",
    "handles_badly",
    "accessibility_strengths",
    "accessibility_weaknesses",
    "best_input_types",
    "best_output_types",
    "advanced_capability_types_requiring_another_interface",
    "selection_reasons",
    "rejection_reasons",
    "features",
    "task_affinity",
    "input_affinity",
    "output_affinity",
    "device_affinity",
    "required_tool_any",
}

ALLOWED_PREVIEW = {"none", "status", "preview", "live_preview"}
ALLOWED_ERROR = {"low", "medium", "high", "unknown"}
ALLOWED_REVERSIBILITY = {"none", "limited", "medium", "strong", "unknown"}


class RegistryValidationError(ValueError):
    """Raised when interface-pattern registry data cannot be trusted for selection."""


@dataclass(frozen=True)
class PatternScore:
    pattern: dict[str, Any]
    score: float
    reasons: tuple[str, ...]
    penalties: tuple[str, ...]
    eligible: bool = True
    eligibility_blockers: tuple[str, ...] = ()


def _canonical_registry_bytes(data: dict[str, Any]) -> bytes:
    return json.dumps(
        data,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


def validate_registry_data(data: Any) -> dict[str, Any]:
    """Validate the module-owned registry without silently repairing it."""
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    if not isinstance(data, dict):
        return {
            "valid": False,
            "errors": [{"path": "/", "message": "Registry must be an object."}],
            "warnings": [],
            "pattern_count": 0,
        }

    required_top = {"registry_id", "registry_version", "contract_version", "patterns"}
    for field in sorted(required_top - set(data)):
        errors.append({"path": f"/{field}", "message": "Required registry field is missing."})
    for field in sorted(set(data) - required_top):
        warnings.append({"path": f"/{field}", "message": "Unrecognized additive registry metadata."})

    if data.get("contract_version") != CONTRACT_VERSION:
        errors.append({
            "path": "/contract_version",
            "message": f"Registry contract_version must equal {CONTRACT_VERSION!r} for this module build.",
        })
    for field in ("registry_id", "registry_version"):
        if field in data and (not isinstance(data.get(field), str) or not str(data.get(field)).strip()):
            errors.append({"path": f"/{field}", "message": "Value must be a non-empty string."})

    patterns = data.get("patterns")
    if not isinstance(patterns, list) or not patterns:
        errors.append({"path": "/patterns", "message": "patterns must be a non-empty array."})
        patterns = []

    seen_ids: set[str] = set()
    for index, pattern in enumerate(patterns):
        path = f"/patterns/{index}"
        if not isinstance(pattern, dict):
            errors.append({"path": path, "message": "Pattern must be an object."})
            continue
        missing = REQUIRED_PATTERN_FIELDS - set(pattern)
        for field in sorted(missing):
            errors.append({"path": f"{path}/{field}", "message": "Required pattern field is missing."})

        pattern_id = pattern.get("interface_pattern_id")
        if not isinstance(pattern_id, str) or not pattern_id.strip():
            errors.append({"path": f"{path}/interface_pattern_id", "message": "Pattern ID must be a non-empty string."})
        elif pattern_id in seen_ids:
            errors.append({"path": f"{path}/interface_pattern_id", "message": f"Duplicate pattern ID: {pattern_id!r}."})
        else:
            seen_ids.add(pattern_id)

        for field in ("interface_name", "interface_family"):
            value = pattern.get(field)
            if field in pattern and (not isinstance(value, str) or not value.strip()):
                errors.append({"path": f"{path}/{field}", "message": "Value must be a non-empty string."})

        for field in LIST_PATTERN_FIELDS:
            if field not in pattern:
                continue
            value = pattern.get(field)
            if not isinstance(value, list) or any(not isinstance(item, str) or not item.strip() for item in value):
                errors.append({"path": f"{path}/{field}", "message": "Value must be an array of non-empty strings."})
            elif len(value) != len(set(value)):
                errors.append({"path": f"{path}/{field}", "message": "Duplicate list entries are not allowed."})

        if pattern.get("minimum_user_skill") not in SKILL_ORDER:
            errors.append({"path": f"{path}/minimum_user_skill", "message": "Unsupported skill enum."})
        for field in ("attention_cost", "interaction_cost", "compute_overhead"):
            if pattern.get(field) not in COST_ORDER:
                errors.append({"path": f"{path}/{field}", "message": "Unsupported cost enum."})
        if pattern.get("error_likelihood") not in ALLOWED_ERROR:
            errors.append({"path": f"{path}/error_likelihood", "message": "Unsupported error_likelihood enum."})
        if pattern.get("preview_capability") not in ALLOWED_PREVIEW:
            errors.append({"path": f"{path}/preview_capability", "message": "Unsupported preview_capability enum."})
        if pattern.get("reversibility_support") not in ALLOWED_REVERSIBILITY:
            errors.append({"path": f"{path}/reversibility_support", "message": "Unsupported reversibility_support enum."})
        for field in ("beginner_suitable", "offline_capable"):
            if field in pattern and not isinstance(pattern.get(field), bool):
                errors.append({"path": f"{path}/{field}", "message": "Value must be boolean."})

    return {
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "pattern_count": len(patterns),
        "unique_pattern_count": len(seen_ids),
    }


class PatternRegistry:
    def __init__(self, data: dict[str, Any] | None = None) -> None:
        loaded = load_json(DATA_ROOT / "interface_patterns.json") if data is None else copy.deepcopy(data)
        report = validate_registry_data(loaded)
        if not report["valid"]:
            details = "; ".join(f"{item['path']}: {item['message']}" for item in report["errors"][:12])
            raise RegistryValidationError(f"Interface-pattern registry is invalid. {details}")
        # Keep an internal snapshot and never expose mutable references that could
        # change selection behavior after the fingerprint has been issued.
        self._data = copy.deepcopy(loaded)
        self.validation_report = copy.deepcopy(report)
        self._patterns = tuple(copy.deepcopy(self._data["patterns"]))
        self._by_id = {item["interface_pattern_id"]: item for item in self._patterns}
        self.fingerprint = f"sha256:{hashlib.sha256(_canonical_registry_bytes(self._data)).hexdigest()}"

    @property
    def data(self) -> dict[str, Any]:
        return copy.deepcopy(self._data)

    @property
    def patterns(self) -> list[dict[str, Any]]:
        return copy.deepcopy(list(self._patterns))

    def get(self, pattern_id: str) -> dict[str, Any]:
        return copy.deepcopy(self._by_id[pattern_id])

    def __iter__(self) -> Iterable[dict[str, Any]]:
        return iter(copy.deepcopy(list(self._patterns)))
