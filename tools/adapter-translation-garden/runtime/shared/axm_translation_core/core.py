from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from typing import Any, Iterable


def canonical_json_bytes(value: Any) -> bytes:
    """Return deterministic UTF-8 JSON bytes for JSON-compatible values."""
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def contract_fingerprint(value: Any, algorithm: str = "sha256") -> dict[str, Any]:
    if algorithm != "sha256":
        raise ValueError("Only sha256 is supported in the dependency-free prototype")
    payload = canonical_json_bytes(value)
    return {
        "algorithm": algorithm,
        "digest": hashlib.sha256(payload).hexdigest(),
        "canonical_bytes": len(payload),
    }


def new_loss_ledger() -> dict[str, Any]:
    return {
        "schema": "axm.translation.loss-ledger/v1",
        "entries": [],
        "summary": {"count": 0, "by_kind": {}, "max_severity": "none", "has_blocking_loss": False},
    }


def _severity_rank(value: str) -> int:
    return {"none": 0, "info": 1, "low": 2, "medium": 3, "high": 4, "blocking": 5}.get(value, 5)


def summarize_loss(ledger: dict[str, Any]) -> dict[str, Any]:
    by_kind: dict[str, int] = {}
    max_severity = "none"
    for entry in ledger.get("entries", []):
        kind = str(entry.get("kind", "unspecified"))
        by_kind[kind] = by_kind.get(kind, 0) + 1
        severity = str(entry.get("severity", "blocking"))
        if _severity_rank(severity) > _severity_rank(max_severity):
            max_severity = severity
    summary = {
        "count": len(ledger.get("entries", [])),
        "by_kind": dict(sorted(by_kind.items())),
        "max_severity": max_severity,
        "has_blocking_loss": _severity_rank(max_severity) >= _severity_rank("blocking"),
    }
    ledger["summary"] = summary
    return summary


def add_loss(
    ledger: dict[str, Any],
    *,
    kind: str,
    path: str,
    source_value: Any = None,
    target_value: Any = None,
    reason: str,
    severity: str = "medium",
    reversible: bool = False,
    evidence: Iterable[str] | None = None,
) -> dict[str, Any]:
    if severity not in {"info", "low", "medium", "high", "blocking"}:
        raise ValueError(f"Unsupported severity: {severity}")
    entry = {
        "kind": kind,
        "path": path,
        "source_value": deepcopy(source_value),
        "target_value": deepcopy(target_value),
        "reason": reason,
        "severity": severity,
        "reversible": bool(reversible),
        "evidence": list(evidence or []),
    }
    ledger.setdefault("entries", []).append(entry)
    summarize_loss(ledger)
    return entry


def _value_allowed(value: Any, allowed: list[Any] | None) -> bool:
    if allowed is None:
        return True
    return value in allowed


def allowlist_decision(request: dict[str, Any], rules: dict[str, Any]) -> dict[str, Any]:
    """Deny by default unless every declared dimension is allowed."""
    checks = {
        "operation": _value_allowed(request.get("operation"), rules.get("operations")),
        "path": _value_allowed(request.get("path"), rules.get("paths")),
        "host": _value_allowed(request.get("host"), rules.get("hosts")),
        "media_type": _value_allowed(request.get("media_type"), rules.get("media_types")),
        "entity_type": _value_allowed(request.get("entity_type"), rules.get("entity_types")),
        "target_canvas": _value_allowed(request.get("target_canvas"), rules.get("target_canvases")),
    }
    declared_dimensions = [
        key for key, rule_key in {
            "operation": "operations", "path": "paths", "host": "hosts",
            "media_type": "media_types", "entity_type": "entity_types",
            "target_canvas": "target_canvases"
        }.items() if rules.get(rule_key) is not None
    ]
    if not declared_dimensions:
        return {"allowed": False, "reason": "No allowlist dimensions were declared", "checks": checks}
    failed = [key for key in declared_dimensions if not checks[key]]
    return {
        "allowed": not failed,
        "reason": "Allowed by explicit rules" if not failed else "Denied: " + ", ".join(failed),
        "checks": checks,
    }


def diff_values(source: Any, target: Any, path: str = "$") -> list[dict[str, Any]]:
    changes: list[dict[str, Any]] = []
    if type(source) is not type(target):
        return [{"path": path, "kind": "type_change", "source": source, "target": target}]
    if isinstance(source, dict):
        source_keys, target_keys = set(source), set(target)
        for key in sorted(source_keys - target_keys):
            changes.append({"path": f"{path}.{key}", "kind": "removed", "source": source[key], "target": None})
        for key in sorted(target_keys - source_keys):
            changes.append({"path": f"{path}.{key}", "kind": "added", "source": None, "target": target[key]})
        for key in sorted(source_keys & target_keys):
            changes.extend(diff_values(source[key], target[key], f"{path}.{key}"))
        return changes
    if isinstance(source, list):
        common = min(len(source), len(target))
        for idx in range(common):
            changes.extend(diff_values(source[idx], target[idx], f"{path}[{idx}]"))
        for idx in range(common, len(source)):
            changes.append({"path": f"{path}[{idx}]", "kind": "removed", "source": source[idx], "target": None})
        for idx in range(common, len(target)):
            changes.append({"path": f"{path}[{idx}]", "kind": "added", "source": None, "target": target[idx]})
        return changes
    if source != target:
        changes.append({"path": path, "kind": "changed", "source": source, "target": target})
    return changes


def build_proof_packet(
    *,
    request_id: str,
    source: Any,
    target: Any,
    loss_ledger: dict[str, Any],
    authority: dict[str, Any],
    claims: list[dict[str, Any]] | None = None,
    approvals: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    source_fp = contract_fingerprint(source)
    target_fp = contract_fingerprint(target)
    changes = diff_values(source, target)
    summary = summarize_loss(loss_ledger)
    if summary["has_blocking_loss"]:
        verdict = "REFUSE"
    elif summary["count"]:
        verdict = "PASS_WITH_VISIBLE_LOSS"
    elif claims:
        verdict = "PASS"
    else:
        verdict = "UNPROVEN"
    return {
        "schema": "axm.translation.proof-packet/v1",
        "request_id": request_id,
        "claims": deepcopy(claims or []),
        "fingerprints": {"source": source_fp, "target": target_fp},
        "diff": changes,
        "loss": deepcopy(loss_ledger),
        "authority": deepcopy(authority),
        "approvals": deepcopy(approvals or []),
        "verdict": verdict,
    }


def explain_translation(packet: dict[str, Any]) -> str:
    verdict = packet.get("verdict", "UNPROVEN")
    loss = packet.get("loss", {}).get("summary", {})
    lines = [
        f"Translation verdict: {verdict}.",
        f"Visible loss entries: {loss.get('count', 0)}; maximum severity: {loss.get('max_severity', 'none')}.",
        f"Recorded structural differences: {len(packet.get('diff', []))}.",
    ]
    authority = packet.get("authority", {})
    if authority:
        lines.append("Authority: " + ", ".join(f"{k}={v}" for k, v in sorted(authority.items())) + ".")
    if verdict == "REFUSE":
        lines.append("The translation must not proceed because blocking loss is recorded.")
    elif verdict == "PASS_WITH_VISIBLE_LOSS":
        lines.append("The result is usable only with the listed loss kept visible to the human or calling system.")
    elif verdict == "PASS":
        lines.append("The declared checks passed; this is evidence for this packet, not universal compatibility proof.")
    else:
        lines.append("No sufficient proof claim was supplied, so the result remains unproven.")
    return "\n".join(lines)
