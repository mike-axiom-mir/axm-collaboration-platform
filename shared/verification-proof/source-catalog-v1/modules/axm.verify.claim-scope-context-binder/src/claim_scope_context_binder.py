"""Detached AXM Claim Scope and Context Binder v0.1.0."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Mapping, Sequence, Tuple
import copy
import hashlib
import json

SUPPORTED_DIMENSIONS = (
    "artifact_versions",
    "environments",
    "devices",
    "datasets",
    "configurations",
    "time_window",
    "excluded_conditions",
    "extensions",
)

_LIST_DIMENSIONS = {
    "artifact_versions": ("artifact_id", "version"),
    "environments": ("environment_id", "version"),
    "devices": ("device_id", "profile"),
    "datasets": ("dataset_id", "version"),
    "configurations": ("configuration_id", "digest"),
}

class ScopeBindingError(ValueError):
    """A scope binding cannot be represented without ambiguity."""

def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ScopeBindingError(f"{field} must be a non-empty string")
    return value.strip()

def _canonical(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

def _validate_list_dimension(name: str, value: Any, required_fields: Tuple[str, str]) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise ScopeBindingError(f"{name} must be a list")
    result = []
    identities = set()
    identity_field = required_fields[0]
    for index, raw in enumerate(value):
        if not isinstance(raw, Mapping):
            raise ScopeBindingError(f"{name}[{index}] must be an object")
        item = copy.deepcopy(dict(raw))
        for field in required_fields:
            item[field] = _text(item.get(field), f"{name}[{index}].{field}")
        identity = item[identity_field]
        if identity in identities:
            raise ScopeBindingError(f"duplicate {identity_field} in {name}: {identity}")
        identities.add(identity)
        result.append(item)
    return sorted(result, key=lambda item: item[identity_field])

def validate_context(context: Mapping[str, Any]) -> Dict[str, Any]:
    if not isinstance(context, Mapping):
        raise ScopeBindingError("context must be an object")
    unknown = sorted(set(context) - set(SUPPORTED_DIMENSIONS))
    if unknown:
        raise ScopeBindingError("unknown context dimensions: " + ", ".join(unknown))

    normalized: Dict[str, Any] = {}
    for name, required_fields in _LIST_DIMENSIONS.items():
        if name in context:
            normalized[name] = _validate_list_dimension(name, context[name], required_fields)

    if "time_window" in context:
        raw = context["time_window"]
        if not isinstance(raw, Mapping):
            raise ScopeBindingError("time_window must be an object")
        window = copy.deepcopy(dict(raw))
        for field in ("start", "end", "timezone"):
            window[field] = _text(window.get(field), f"time_window.{field}")
        normalized["time_window"] = window

    if "excluded_conditions" in context:
        raw = context["excluded_conditions"]
        if not isinstance(raw, list):
            raise ScopeBindingError("excluded_conditions must be a list")
        clean = []
        seen = set()
        for index, item in enumerate(raw):
            label = _text(item, f"excluded_conditions[{index}]")
            if label in seen:
                raise ScopeBindingError(f"duplicate excluded condition: {label}")
            seen.add(label)
            clean.append(label)
        normalized["excluded_conditions"] = sorted(clean)

    if "extensions" in context:
        if not isinstance(context["extensions"], Mapping):
            raise ScopeBindingError("extensions must be an object")
        normalized["extensions"] = copy.deepcopy(dict(context["extensions"]))

    if not normalized:
        raise ScopeBindingError("context must contain at least one supported dimension")
    return normalized

@dataclass(frozen=True)
class ClaimScopeContextBinder:
    required_dimensions: Sequence[str] = ()

    def __post_init__(self) -> None:
        clean = []
        seen = set()
        for index, item in enumerate(self.required_dimensions):
            name = _text(item, f"required_dimensions[{index}]")
            if name not in SUPPORTED_DIMENSIONS:
                raise ScopeBindingError(f"unsupported required dimension: {name}")
            if name in seen:
                raise ScopeBindingError(f"duplicate required dimension: {name}")
            seen.add(name)
            clean.append(name)
        object.__setattr__(self, "required_dimensions", tuple(clean))

    def bind(self, claim: Mapping[str, Any], context: Mapping[str, Any]) -> Dict[str, Any]:
        if not isinstance(claim, Mapping):
            raise ScopeBindingError("claim must be an object")
        claim_id = _text(claim.get("claim_id"), "claim.claim_id")
        subject = _text(claim.get("subject"), "claim.subject")
        normalized = validate_context(context)
        missing = [name for name in self.required_dimensions if name not in normalized]
        digest_input = {"claim_id": claim_id, "subject": subject, "context": normalized}
        binding_id = "scope:" + hashlib.sha256(_canonical(digest_input).encode("utf-8")).hexdigest()
        return {
            "schema_version": "axm.verify.scope-binding/0.1",
            "binding_id": binding_id,
            "claim_id": claim_id,
            "subject": subject,
            "context": copy.deepcopy(normalized),
            "required_dimensions": list(self.required_dimensions),
            "missing_required_dimensions": missing,
            "binding_complete": not missing,
            "context_truth_verified": False,
            "authority": "NONE",
            "canon": False,
        }
