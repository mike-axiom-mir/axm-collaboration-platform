"""Detached AXM Typed Claim Registry v0.1.0.

Standard-library reference implementation.
It stores claims; it never verifies, approves, releases, or promotes them.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping
import copy
import json

CANONICAL_VERDICTS = (
    "PASS",
    "FAIL",
    "UNKNOWN",
    "NOT_RUN",
    "CONFLICTED",
    "STALE",
    "HUMAN_REVIEW",
)

REQUIRED_FIELDS = (
    "claim_id",
    "claim_type",
    "subject",
    "scope",
    "risk",
    "owner",
    "status",
    "required_proof_surfaces",
)

class ClaimRegistryError(ValueError):
    """Base error for bounded claim-registry refusals."""

class ClaimValidationError(ClaimRegistryError):
    """The supplied claim does not satisfy the detached contract."""

class DuplicateClaimError(ClaimRegistryError):
    """A claim ID already exists and may not be silently overwritten."""

class CorruptRegistryError(ClaimRegistryError):
    """Stored events do not satisfy the append-only registry contract."""

def _nonempty_string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ClaimValidationError(f"{field} must be a non-empty string")
    return value.strip()

def validate_claim(claim: Mapping[str, Any]) -> Dict[str, Any]:
    if not isinstance(claim, Mapping):
        raise ClaimValidationError("claim must be an object")

    missing = [field for field in REQUIRED_FIELDS if field not in claim]
    if missing:
        raise ClaimValidationError("missing required fields: " + ", ".join(missing))

    normalized = copy.deepcopy(dict(claim))
    for field in ("claim_id", "claim_type", "subject", "risk", "owner"):
        normalized[field] = _nonempty_string(normalized[field], field)

    if not isinstance(normalized["scope"], dict):
        raise ClaimValidationError("scope must be an object")
    if not normalized["scope"]:
        raise ClaimValidationError("scope must not be empty")

    status = _nonempty_string(normalized["status"], "status").upper()
    if status not in CANONICAL_VERDICTS:
        raise ClaimValidationError(
            "status must be one of: " + ", ".join(CANONICAL_VERDICTS)
        )
    normalized["status"] = status

    surfaces = normalized["required_proof_surfaces"]
    if not isinstance(surfaces, list) or not surfaces:
        raise ClaimValidationError("required_proof_surfaces must be a non-empty list")
    clean_surfaces: List[str] = []
    seen = set()
    for index, surface in enumerate(surfaces):
        item = _nonempty_string(surface, f"required_proof_surfaces[{index}]")
        if item in seen:
            raise ClaimValidationError(f"duplicate proof surface: {item}")
        seen.add(item)
        clean_surfaces.append(item)
    normalized["required_proof_surfaces"] = clean_surfaces

    normalized.setdefault("schema_version", "axm.verify.claim/0.1")
    if normalized["schema_version"] != "axm.verify.claim/0.1":
        raise ClaimValidationError("unsupported schema_version")

    return normalized

@dataclass
class TypedClaimRegistry:
    path: Path

    def __init__(self, path: str | Path):
        self.path = Path(path)

    def _load(self) -> Dict[str, Dict[str, Any]]:
        claims: Dict[str, Dict[str, Any]] = {}
        if not self.path.exists():
            return claims

        with self.path.open("r", encoding="utf-8") as handle:
            for line_number, raw in enumerate(handle, 1):
                if not raw.strip():
                    continue
                try:
                    event = json.loads(raw)
                except json.JSONDecodeError as exc:
                    raise CorruptRegistryError(
                        f"invalid JSON at line {line_number}: {exc.msg}"
                    ) from exc
                if event.get("event") != "REGISTER_CLAIM":
                    raise CorruptRegistryError(
                        f"unsupported event at line {line_number}"
                    )
                claim = validate_claim(event.get("claim"))
                claim_id = claim["claim_id"]
                if claim_id in claims:
                    raise CorruptRegistryError(
                        f"duplicate stored claim_id at line {line_number}: {claim_id}"
                    )
                claims[claim_id] = claim
        return claims

    def register(self, claim: Mapping[str, Any]) -> Dict[str, Any]:
        normalized = validate_claim(claim)
        existing = self._load()
        claim_id = normalized["claim_id"]
        if claim_id in existing:
            raise DuplicateClaimError(
                f"claim_id already registered; silent overwrite refused: {claim_id}"
            )

        self.path.parent.mkdir(parents=True, exist_ok=True)
        event = {
            "event": "REGISTER_CLAIM",
            "claim": normalized,
        }
        with self.path.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(
                json.dumps(event, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
                + "\n"
            )
        return copy.deepcopy(normalized)

    def get(self, claim_id: str) -> Dict[str, Any] | None:
        key = _nonempty_string(claim_id, "claim_id")
        claim = self._load().get(key)
        return copy.deepcopy(claim) if claim is not None else None

    def list_claims(self) -> List[Dict[str, Any]]:
        claims = self._load()
        return [copy.deepcopy(claims[key]) for key in sorted(claims)]

    def snapshot(self) -> Dict[str, Any]:
        claims = self.list_claims()
        return {
            "schema_version": "axm.verify.claim-registry-snapshot/0.1",
            "claim_count": len(claims),
            "claims": claims,
            "authority": "NONE",
            "canon": False,
        }
