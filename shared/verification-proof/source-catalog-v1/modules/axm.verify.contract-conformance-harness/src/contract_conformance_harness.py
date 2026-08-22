"""Detached AXM Contract Conformance Harness v0.1.0."""
from __future__ import annotations
from hashlib import sha256
from typing import Any, Dict, Mapping
import json

class ContractConformanceError(ValueError):
    pass

def _canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")

def _matches(value: Any, type_name: str) -> bool:
    return {
        "string": lambda: isinstance(value, str),
        "integer": lambda: isinstance(value, int) and not isinstance(value, bool),
        "number": lambda: isinstance(value, (int, float)) and not isinstance(value, bool),
        "boolean": lambda: isinstance(value, bool),
        "mapping": lambda: isinstance(value, Mapping),
        "array": lambda: isinstance(value, list),
        "null": lambda: value is None,
    }.get(type_name, lambda: False)()

class ContractConformanceHarness:
    def __init__(self, contract: Mapping[str, Any]):
        if not isinstance(contract, Mapping):
            raise ContractConformanceError("contract must be a mapping")
        self.contract = dict(contract)
        for section in ("required_fields", "optional_fields"):
            if not isinstance(self.contract.get(section, {}), Mapping):
                raise ContractConformanceError(f"{section} must be a mapping")
            for name, spec in self.contract.get(section, {}).items():
                normalized = {"type": spec} if isinstance(spec, str) else dict(spec)
                if normalized.get("type") not in {"string","integer","number","boolean","mapping","array","null"}:
                    raise ContractConformanceError(f"unsupported type for {name}")
        operations = self.contract.get("operations", {})
        if not isinstance(operations, Mapping):
            raise ContractConformanceError("operations must be a mapping")
        self.contract_sha256 = sha256(_canonical(self.contract)).hexdigest()

    def _field_findings(self, payload: Mapping[str, Any]):
        findings = []
        required = self.contract.get("required_fields", {})
        optional = self.contract.get("optional_fields", {})
        for name in required:
            if name not in payload:
                findings.append({"code":"MISSING_REQUIRED","path":name})
        known = set(required) | set(optional)
        if not self.contract.get("allow_additional", True):
            for name in sorted(set(payload)-known):
                findings.append({"code":"ADDITIONAL_FIELD","path":name})
        for name, raw_spec in {**required, **optional}.items():
            if name not in payload:
                continue
            spec = {"type": raw_spec} if isinstance(raw_spec, str) else dict(raw_spec)
            value = payload[name]
            if not _matches(value, spec["type"]):
                findings.append({"code":"TYPE_MISMATCH","path":name,"expected":spec["type"]})
                continue
            if "enum" in spec and value not in spec["enum"]:
                findings.append({"code":"ENUM_MISMATCH","path":name})
            if "minimum" in spec and value < spec["minimum"]:
                findings.append({"code":"BELOW_MINIMUM","path":name})
            if "maximum" in spec and value > spec["maximum"]:
                findings.append({"code":"ABOVE_MAXIMUM","path":name})
        return findings

    def evaluate(self, payload: Mapping[str, Any], *, operation: str | None = None,
                 current_state: str | None = None, observed_state: str | None = None,
                 refused: bool = False) -> Dict[str, Any]:
        if not isinstance(payload, Mapping):
            raise ContractConformanceError("payload must be a mapping")
        findings = self._field_findings(payload)
        if operation is not None:
            spec = self.contract.get("operations", {}).get(operation)
            if spec is None:
                findings.append({"code":"UNKNOWN_OPERATION","operation":operation})
            else:
                allowed = spec.get("allowed_from", [])
                if current_state not in allowed:
                    findings.append({"code":"INVALID_SOURCE_STATE","operation":operation,"state":current_state})
                expected = spec.get("next_state")
                if observed_state != expected:
                    findings.append({"code":"NEXT_STATE_MISMATCH","expected":expected,"observed":observed_state})
        if refused and observed_state not in self.contract.get("refusal_states", []):
            findings.append({"code":"UNDECLARED_REFUSAL_STATE","observed":observed_state})
        return {
            "schema_version":"axm.verify.contract-conformance-receipt/0.1",
            "contract_sha256":self.contract_sha256,
            "verdict_state":"PASS" if not findings else "FAIL",
            "findings":findings,
            "target_executed":False,
            "contract_completeness_assumed":False,
            "authority":"NONE",
            "canon":False,
        }
