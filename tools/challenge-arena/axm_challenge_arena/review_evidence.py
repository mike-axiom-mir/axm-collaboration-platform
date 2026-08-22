from __future__ import annotations

from typing import Any

from .errors import ValidationError
from .utils import safe_relative_path

ALLOWED_EVIDENCE_REFERENCE_KINDS = {
    "artifact",
    "deterministic_check",
    "manifest",
    "observation",
}


def _bounded_text(
    value: Any,
    field: str,
    *,
    required: bool = False,
    maximum: int = 4_000,
) -> str:
    text = str(value or "").strip()
    if required and not text:
        raise ValidationError(f"{field} must be a non-empty string.")
    if len(text) > maximum:
        raise ValidationError(f"{field} exceeds the {maximum}-character limit.")
    return text


def normalize_abstentions(
    raw: Any,
    *,
    label: str,
    peer_criterion_ids: set[str],
    allow_abstention: bool,
) -> dict[str, dict[str, str]]:
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise ValidationError(f"Evaluation abstentions for {label} must be an object.")
    if raw and not allow_abstention:
        raise ValidationError("Criterion abstention is disabled by the locked challenge policy.")
    unknown = sorted(set(raw) - peer_criterion_ids)
    if unknown:
        raise ValidationError(f"Evaluation for {label} abstains from unknown criteria: {unknown}")

    normalized: dict[str, dict[str, str]] = {}
    for criterion_id, value in raw.items():
        if isinstance(value, str):
            reason = value
            missing_capability = ""
        elif isinstance(value, dict):
            reason = value.get("reason", "")
            missing_capability = value.get("missing_capability", "")
        else:
            raise ValidationError(
                f"Abstention {criterion_id} for {label} must be a string or object."
            )
        normalized[criterion_id] = {
            "reason": _bounded_text(
                reason,
                f"Abstention {criterion_id} for {label}.reason",
                required=True,
            ),
            "missing_capability": _bounded_text(
                missing_capability,
                f"Abstention {criterion_id} for {label}.missing_capability",
                maximum=500,
            ),
        }
    return normalized


def normalize_evidence_refs(
    raw: Any,
    *,
    label: str,
    scored_criterion_ids: set[str],
    manifest: dict[str, Any],
    deterministic_results: dict[str, Any],
    require_score_evidence: bool,
    minimum_refs: int,
    maximum_refs_per_criterion: int = 20,
) -> dict[str, list[dict[str, str]]]:
    if raw is None:
        raw = {}
    if not isinstance(raw, dict):
        raise ValidationError(f"Evaluation evidence_refs for {label} must be an object.")
    unknown = sorted(set(raw) - scored_criterion_ids)
    if unknown:
        raise ValidationError(
            f"Evaluation for {label} supplies evidence for unscored criteria: {unknown}"
        )

    artifact_paths = {
        str(item.get("path", "")).replace("\\", "/")
        for item in manifest.get("artifacts", [])
        if isinstance(item, dict) and item.get("path")
    }
    check_ids = {
        str(item.get("check_id"))
        for item in deterministic_results.get("checks", [])
        if isinstance(item, dict) and item.get("check_id")
    }
    manifest_roots = set(manifest)

    normalized: dict[str, list[dict[str, str]]] = {}
    for criterion_id in sorted(scored_criterion_ids):
        refs = raw.get(criterion_id, [])
        if not isinstance(refs, list):
            raise ValidationError(
                f"evidence_refs.{criterion_id} for {label} must be a list."
            )
        if len(refs) > maximum_refs_per_criterion:
            raise ValidationError(
                f"evidence_refs.{criterion_id} for {label} exceeds "
                f"{maximum_refs_per_criterion} references."
            )
        if require_score_evidence and len(refs) < minimum_refs:
            raise ValidationError(
                f"Score {criterion_id} for {label} requires at least {minimum_refs} evidence reference(s)."
            )

        cleaned: list[dict[str, str]] = []
        for index, ref in enumerate(refs, start=1):
            if not isinstance(ref, dict):
                raise ValidationError(
                    f"Evidence reference {index} for {label}/{criterion_id} must be an object."
                )
            kind = str(ref.get("kind", "")).strip().lower()
            if kind not in ALLOWED_EVIDENCE_REFERENCE_KINDS:
                raise ValidationError(
                    f"Evidence reference {index} for {label}/{criterion_id} has unknown kind {kind!r}."
                )
            cleaned_ref: dict[str, str] = {"kind": kind}
            note = _bounded_text(
                ref.get("note", ""),
                f"Evidence reference {index} for {label}/{criterion_id}.note",
                required=kind == "observation",
                maximum=2_000,
            )
            if note:
                cleaned_ref["note"] = note

            if kind == "artifact":
                raw_path = _bounded_text(
                    ref.get("path", ""),
                    f"Evidence reference {index} for {label}/{criterion_id}.path",
                    required=True,
                    maximum=1_000,
                ).replace("\\", "/")
                try:
                    path = safe_relative_path(raw_path).as_posix()
                except ValueError as exc:
                    raise ValidationError(str(exc)) from exc
                if path not in artifact_paths:
                    raise ValidationError(
                        f"Evidence reference {index} for {label}/{criterion_id} names undeclared artifact {path!r}."
                    )
                cleaned_ref["path"] = path
                locator = _bounded_text(
                    ref.get("locator", ""),
                    f"Evidence reference {index} for {label}/{criterion_id}.locator",
                    maximum=500,
                )
                if locator:
                    cleaned_ref["locator"] = locator
            elif kind == "deterministic_check":
                check_id = _bounded_text(
                    ref.get("check_id", ""),
                    f"Evidence reference {index} for {label}/{criterion_id}.check_id",
                    required=True,
                    maximum=128,
                )
                if check_id not in check_ids:
                    raise ValidationError(
                        f"Evidence reference {index} for {label}/{criterion_id} names unknown deterministic check {check_id!r}."
                    )
                cleaned_ref["check_id"] = check_id
            elif kind == "manifest":
                field = _bounded_text(
                    ref.get("field", ""),
                    f"Evidence reference {index} for {label}/{criterion_id}.field",
                    required=True,
                    maximum=500,
                )
                root = field.split(".", 1)[0]
                if root not in manifest_roots:
                    raise ValidationError(
                        f"Evidence reference {index} for {label}/{criterion_id} names unknown manifest field {field!r}."
                    )
                cleaned_ref["field"] = field

            cleaned.append(cleaned_ref)
        normalized[criterion_id] = cleaned
    return normalized


def normalize_ranking_tiers(
    *,
    ranking: Any,
    ranking_tiers: Any,
    expected_labels: set[str],
    require_complete: bool,
    allow_ties: bool,
) -> tuple[list[list[str]], list[str]]:
    if ranking_tiers is None:
        if not isinstance(ranking, list):
            raise ValidationError("Review requires ranking_tiers or a legacy ranking list.")
        tiers: list[list[str]] = [[str(label)] for label in ranking]
    else:
        if not isinstance(ranking_tiers, list):
            raise ValidationError("ranking_tiers must be a list of non-empty label lists.")
        tiers = []
        for index, tier in enumerate(ranking_tiers, start=1):
            if not isinstance(tier, list) or not tier:
                raise ValidationError(f"ranking_tiers[{index}] must be a non-empty list.")
            labels = [str(label) for label in tier]
            if len(labels) != len(set(labels)):
                raise ValidationError(f"ranking_tiers[{index}] contains duplicate labels.")
            if len(labels) > 1 and not allow_ties:
                raise ValidationError("Tied ranking tiers are disabled by the locked challenge policy.")
            tiers.append(labels)

    flattened = [label for tier in tiers for label in tier]
    if len(flattened) != len(set(flattened)):
        raise ValidationError("ranking_tiers may not repeat a candidate label.")
    supplied = set(flattened)
    if require_complete and supplied != expected_labels:
        raise ValidationError(
            f"Complete ranking required. Expected exactly {sorted(expected_labels)}; got {sorted(supplied)}."
        )
    if not supplied.issubset(expected_labels):
        raise ValidationError("Review ranking references an unknown or prohibited candidate label.")
    if ranking is not None:
        if not isinstance(ranking, list):
            raise ValidationError("ranking must be a list when supplied.")
        if [str(label) for label in ranking] != flattened:
            raise ValidationError("ranking and ranking_tiers disagree.")
    return tiers, flattened
