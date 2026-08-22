"""Detached AXM Claim-to-Proof Surface Router v0.1.0."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Mapping, Sequence
import copy

class ProofSurfaceRoutingError(ValueError):
    """Routing input is ambiguous or violates the detached contract."""

def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ProofSurfaceRoutingError(f"{field} must be a non-empty string")
    return value.strip()

def _surface_list(value: Any, field: str) -> list[str]:
    if not isinstance(value, (list, tuple)) or not value:
        raise ProofSurfaceRoutingError(f"{field} must be a non-empty list")
    result = []
    seen = set()
    for index, raw in enumerate(value):
        item = _text(raw, f"{field}[{index}]")
        if item in seen:
            raise ProofSurfaceRoutingError(f"duplicate proof surface: {item}")
        seen.add(item)
        result.append(item)
    return result

@dataclass(frozen=True)
class ProofSurfaceRouter:
    surface_registry: Mapping[str, Mapping[str, Any]]
    claim_type_defaults: Mapping[str, Sequence[str]] = field(default_factory=dict)

    def __post_init__(self) -> None:
        registry: Dict[str, Dict[str, Any]] = {}
        for raw_name, raw_entry in dict(self.surface_registry).items():
            name = _text(raw_name, "surface name")
            if not isinstance(raw_entry, Mapping):
                raise ProofSurfaceRoutingError(f"registry entry for {name} must be an object")
            entry = copy.deepcopy(dict(raw_entry))
            entry["verifier_id"] = _text(entry.get("verifier_id"), f"{name}.verifier_id")
            entry["evidence_kind"] = _text(entry.get("evidence_kind"), f"{name}.evidence_kind")
            entry.setdefault("native_authority", False)
            if not isinstance(entry["native_authority"], bool):
                raise ProofSurfaceRoutingError(f"{name}.native_authority must be boolean")
            registry[name] = entry

        defaults: Dict[str, tuple[str, ...]] = {}
        for raw_type, raw_surfaces in dict(self.claim_type_defaults).items():
            claim_type = _text(raw_type, "claim type default key")
            defaults[claim_type] = tuple(_surface_list(raw_surfaces, f"defaults[{claim_type}]"))
        object.__setattr__(self, "surface_registry", registry)
        object.__setattr__(self, "claim_type_defaults", defaults)

    def route(self, claim: Mapping[str, Any], scope_binding: Mapping[str, Any] | None = None) -> Dict[str, Any]:
        if not isinstance(claim, Mapping):
            raise ProofSurfaceRoutingError("claim must be an object")
        claim_id = _text(claim.get("claim_id"), "claim.claim_id")
        claim_type = _text(claim.get("claim_type"), "claim.claim_type")
        declared = _surface_list(claim.get("required_proof_surfaces"), "claim.required_proof_surfaces")
        suggested = list(self.claim_type_defaults.get(claim_type, ()))

        routes = []
        routed = 0
        for surface in declared:
            entry = self.surface_registry.get(surface)
            if entry is None:
                routes.append({"surface": surface, "route_state": "UNROUTED", "verifier": None})
            else:
                routed += 1
                routes.append({"surface": surface, "route_state": "ROUTED", "verifier": copy.deepcopy(entry)})

        if routed == len(routes):
            state = "ROUTED"
        elif routed == 0:
            state = "UNROUTED"
        else:
            state = "PARTIAL"

        scope_state = "UNBOUND"
        scope_binding_id = None
        if scope_binding is not None:
            if not isinstance(scope_binding, Mapping):
                raise ProofSurfaceRoutingError("scope_binding must be an object")
            scope_binding_id = _text(scope_binding.get("binding_id"), "scope_binding.binding_id")
            scope_state = "BOUND_COMPLETE" if scope_binding.get("binding_complete") is True else "BOUND_PARTIAL"

        return {
            "schema_version": "axm.verify.proof-route/0.1",
            "claim_id": claim_id,
            "claim_type": claim_type,
            "route_state": state,
            "scope_state": scope_state,
            "scope_binding_id": scope_binding_id,
            "declared_surfaces": declared,
            "suggested_type_defaults": suggested,
            "suggestions_auto_applied": False,
            "routes": routes,
            "execution_state": "NOT_RUN",
            "authority": "NONE",
            "canon": False,
        }
