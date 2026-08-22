from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable
import hashlib
import json
import re

from .discovery_integrity import classify_registry_role

ADAPTER_VERSION = "1.2.0"
AXM_PUBLIC_CAPABILITY_SCHEMA = "axm.public-capability/v1"
SUPPORTED_SUFFIXES = {".json", ".jsonl", ".ndjson"}

COLLECTION_KEYS = {
    "capabilities",
    "capability_declarations",
    "capabilitydefinitions",
    "capability_definitions",
    "declarations",
    "entries",
    "items",
    "records",
}

WRAPPER_KEYS = {
    "manifest",
    "registry",
    "catalog",
    "data",
    "payload",
    "module",
    "modules",
    "components",
    "plugins",
    "tools",
    "organs",
}

ID_ALIASES = ("capability_id", "capabilityId", "id", "key", "uid", "code")
MACHINE_NAME_ALIASES = ("machine_name", "machineName", "name", "slug", "code")
HUMAN_NAME_ALIASES = ("human_name", "humanName", "display_name", "displayName", "title", "label")
DESCRIPTION_ALIASES = (
    "description",
    "summary",
    "plain_explanation",
    "what_it_does",
    "whatItDoes",
    "purpose",
)
WHY_ALIASES = ("why_it_matters", "whyItMatters", "why", "value", "benefit", "human_value")
REVISION_ALIASES = ("revision", "version", "rev")


@dataclass(frozen=True)
class Detection:
    format_id: str
    confidence: float
    reason: str
    candidate_count: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class Candidate:
    record: dict[str, Any]
    pointer: str
    implied_id: str | None = None


@dataclass
class AdaptedRecord:
    status: str
    pointer: str
    adapter_id: str
    normalized: dict[str, Any] | None
    errors: list[str]
    warnings: list[str]
    raw_record: dict[str, Any]

    def to_report_dict(self, include_raw: bool = False) -> dict[str, Any]:
        result = {
            "status": self.status,
            "pointer": self.pointer,
            "adapter_id": self.adapter_id,
            "capability_id": (self.normalized or {}).get("capability_id"),
            "errors": self.errors,
            "warnings": self.warnings,
        }
        if include_raw:
            result["raw_record"] = self.raw_record
        return result


def _escape_pointer(value: str) -> str:
    return value.replace("~", "~0").replace("/", "~1")


def _join_pointer(base: str, token: str | int) -> str:
    encoded = _escape_pointer(str(token))
    return f"{base}/{encoded}" if base else f"/{encoded}"


def _source_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class DuplicateSourceKeyError(ValueError):
    pass


def _reject_duplicate_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateSourceKeyError(f"Duplicate JSON object key: {key!r}")
        result[key] = value
    return result


def _json_loads_source(text: str):
    return json.loads(text, object_pairs_hook=_reject_duplicate_pairs)


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        try:
            value = _json_loads_source(stripped)
        except (json.JSONDecodeError, DuplicateSourceKeyError) as exc:
            raise ValueError(f"Invalid or ambiguous JSONL at line {line_no}: {exc}") from exc
        if not isinstance(value, dict):
            raise ValueError(f"JSONL line {line_no} must contain an object")
        value = dict(value)
        value.setdefault("__axm_jsonl_line__", line_no)
        records.append(value)
    return records


def load_source_document(path: str | Path) -> Any:
    p = Path(path)
    if p.suffix.lower() in {".jsonl", ".ndjson"}:
        return _read_jsonl(p)
    try:
        return _json_loads_source(p.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"Capability source not found: {p}") from exc
    except (json.JSONDecodeError, DuplicateSourceKeyError) as exc:
        raise ValueError(f"Invalid or ambiguous JSON in {p}: {exc}") from exc


def _has_any(record: dict[str, Any], keys: Iterable[str]) -> bool:
    return any(key in record and record[key] not in (None, "", [], {}) for key in keys)


def _looks_like_capability(record: Any) -> bool:
    if not isinstance(record, dict):
        return False
    has_identity = _has_any(record, ID_ALIASES) or _has_any(record, MACHINE_NAME_ALIASES)
    has_content = _has_any(record, DESCRIPTION_ALIASES) or any(
        key in record
        for key in (
            "inputs",
            "outputs",
            "input_types",
            "output_types",
            "risk_profile",
            "maturity_profile",
            "relationships",
            "tags",
        )
    )
    return has_identity and has_content


def _is_id_map(value: Any) -> bool:
    if not isinstance(value, dict) or not value:
        return False
    object_items = [(key, item) for key, item in value.items() if isinstance(item, dict)]
    if len(object_items) < max(1, len(value) // 2):
        return False
    likely = 0
    for key, item in object_items:
        if _looks_like_capability(item) or re.match(r"^[A-Za-z0-9_.:-]{2,}$", str(key)):
            likely += 1
    return likely >= max(1, len(object_items) // 2)


def _extract_collection(value: Any, pointer: str) -> list[Candidate]:
    candidates: list[Candidate] = []
    if isinstance(value, list):
        for index, item in enumerate(value):
            if isinstance(item, dict):
                candidates.append(Candidate(dict(item), _join_pointer(pointer, index)))
        return candidates
    if isinstance(value, dict):
        if _looks_like_capability(value):
            return [Candidate(dict(value), pointer or "")]
        if _is_id_map(value):
            for key, item in value.items():
                if isinstance(item, dict):
                    candidates.append(Candidate(dict(item), _join_pointer(pointer, key), str(key)))
    return candidates


def extract_candidates(document: Any) -> list[Candidate]:
    """Extract candidate capability records with deterministic JSON-pointer provenance."""
    candidates: list[Candidate] = []
    seen: set[str] = set()

    def add(candidate: Candidate) -> None:
        if candidate.pointer not in seen:
            seen.add(candidate.pointer)
            candidates.append(candidate)

    def walk(value: Any, pointer: str, depth: int) -> None:
        if depth > 8:
            return
        if isinstance(value, list):
            for candidate in _extract_collection(value, pointer):
                add(candidate)
            return
        if not isinstance(value, dict):
            return

        if pointer == "" and _looks_like_capability(value):
            add(Candidate(dict(value), ""))

        for key, child in value.items():
            child_pointer = _join_pointer(pointer, key)
            key_norm = str(key).replace("-", "_").lower()
            if key_norm in COLLECTION_KEYS:
                for candidate in _extract_collection(child, child_pointer):
                    add(candidate)
            elif key_norm in WRAPPER_KEYS:
                if isinstance(child, list):
                    for index, item in enumerate(child):
                        if not isinstance(item, dict):
                            continue
                        item_pointer = _join_pointer(child_pointer, index)
                        if _looks_like_capability(item):
                            add(Candidate(dict(item), item_pointer))
                        else:
                            walk(item, item_pointer, depth + 1)
                elif isinstance(child, dict):
                    if _is_id_map(child) and key_norm in {"registry", "catalog"}:
                        for candidate in _extract_collection(child, child_pointer):
                            add(candidate)
                    else:
                        walk(child, child_pointer, depth + 1)

        if pointer == "" and not candidates and _is_id_map(value):
            for candidate in _extract_collection(value, pointer):
                add(candidate)

    walk(document, "", 0)
    return candidates


def detect_document(document: Any, path: str | Path | None = None) -> Detection:
    p = Path(path) if path is not None else None
    if p and p.suffix.lower() in {".jsonl", ".ndjson"}:
        count = len(document) if isinstance(document, list) else 0
        return Detection("jsonl_records", 1.0, "File extension declares JSON Lines records.", count)

    if isinstance(document, dict) and "capability_id" in document and "machine_name" in document:
        return Detection("normalized_single", 1.0, "Required normalized source fields are present.", 1)

    if isinstance(document, list):
        count = len([item for item in document if isinstance(item, dict)])
        return Detection("list_collection", 0.96, "Top-level array contains object records.", count)

    if isinstance(document, dict):
        collection_hits = []
        for key in document:
            key_norm = str(key).replace("-", "_").lower()
            if key_norm in COLLECTION_KEYS or key_norm in WRAPPER_KEYS:
                collection_hits.append(str(key))
        candidates = extract_candidates(document)
        if collection_hits and candidates:
            return Detection(
                "nested_or_enveloped_registry",
                0.94,
                f"Recognized collection or wrapper keys: {', '.join(collection_hits)}.",
                len(candidates),
            )
        if _is_id_map(document):
            return Detection("id_keyed_map", 0.90, "Top-level object maps stable-looking IDs to records.", len(candidates))
        if _looks_like_capability(document):
            return Detection("generic_single", 0.86, "Object contains capability identity and content aliases.", 1)
        if candidates:
            return Detection("nested_registry", 0.76, "Capability-like records were found recursively.", len(candidates))

    return Detection("unknown", 0.0, "No deterministic capability record structure was recognized.", 0)


def detect_file(path: str | Path) -> Detection:
    p = Path(path)
    return detect_document(load_source_document(p), p)


def _pick(record: dict[str, Any], aliases: Iterable[str]) -> tuple[Any, str | None]:
    for key in aliases:
        if key in record and record[key] not in (None, "", [], {}):
            return record[key], key
    return None, None


def _as_string(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        text = str(value).strip()
        return text or None
    return None


def _as_list(value: Any) -> list[str]:
    if value in (None, "", [], {}):
        return []
    if isinstance(value, list):
        result: list[str] = []
        for item in value:
            if isinstance(item, (str, int, float, bool)):
                text = str(item).strip()
                if text:
                    result.append(text)
            elif isinstance(item, dict):
                label, _ = _pick(item, ("name", "id", "type", "label", "value"))
                text = _as_string(label)
                if text:
                    result.append(text)
        return result
    if isinstance(value, dict):
        return [str(key) for key, enabled in value.items() if bool(enabled)]
    text = _as_string(value)
    if not text:
        return []
    if "," in text:
        return [part.strip() for part in text.split(",") if part.strip()]
    return [text]


def _copy_mapping(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, dict) else {}


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9_.:-]+", "-", value.strip()).strip("-").lower()
    return slug or "unnamed-capability"


def _map_enum(value: Any, mapping: dict[str, str], allowed: set[str], default: str | None = None) -> str | None:
    if isinstance(value, bool):
        key = "true" if value else "false"
    else:
        key = str(value).strip().lower().replace(" ", "_").replace("-", "_") if value is not None else ""
    mapped = mapping.get(key, key)
    if mapped in allowed:
        return mapped
    return default


def _normalize_profiles(record: dict[str, Any], mappings: list[dict[str, Any]], warnings: list[str]) -> dict[str, Any]:
    result: dict[str, Any] = {}

    for profile_name in (
        "cost_profile",
        "risk_profile",
        "maturity_profile",
        "learning_profile",
        "interaction_profile",
        "interface_requirements",
        "relationships",
        "lifecycle_profile",
    ):
        if isinstance(record.get(profile_name), dict):
            result[profile_name] = dict(record[profile_name])
            mappings.append({"target": f"/{profile_name}", "source": f"/{profile_name}", "mode": "direct"})

    maturity = result.setdefault("maturity_profile", {})
    status, status_key = _pick(record, ("status", "state", "lifecycle"))
    if status_key and "maturity" not in maturity:
        maturity_value = _map_enum(
            status,
            {
                "production": "stable",
                "ready": "working",
                "active": "working",
                "alpha": "experimental",
                "beta": "working",
                "retired": "deprecated",
            },
            {"experimental", "working", "tested", "stable", "deprecated", "unknown"},
        )
        if maturity_value:
            maturity["maturity"] = maturity_value
            mappings.append({"target": "/maturity_profile/maturity", "source": f"/{status_key}", "mode": "enum_map"})
        else:
            warnings.append(f"Unrecognized maturity/status value at /{status_key}: {status!r}")

    available, available_key = _pick(record, ("available", "enabled", "availability"))
    if available_key and "availability" not in maturity:
        availability_value = _map_enum(
            available,
            {"true": "available", "false": "unavailable", "enabled": "available", "disabled": "unavailable"},
            {"available", "limited", "unavailable", "unknown"},
        )
        if availability_value:
            maturity["availability"] = availability_value
            mappings.append({"target": "/maturity_profile/availability", "source": f"/{available_key}", "mode": "enum_map"})

    verified, verified_key = _pick(record, ("proof_status", "verified", "tested"))
    if verified_key and "proof_status" not in maturity:
        proof_value = _map_enum(
            verified,
            {
                "true": "tested",
                "false": "unverified",
                "proof": "demonstrated",
                "verified": "independently_verified",
            },
            {"unverified", "declared", "demonstrated", "tested", "independently_verified"},
        )
        if proof_value:
            maturity["proof_status"] = proof_value
            mappings.append({"target": "/maturity_profile/proof_status", "source": f"/{verified_key}", "mode": "enum_map"})

    risk = result.setdefault("risk_profile", {})
    risk_value, risk_key = _pick(record, ("risk", "risk_level", "severity"))
    if risk_key and "risk_level" not in risk:
        mapped = _map_enum(
            risk_value,
            {"none": "minimal", "medium": "moderate", "severe": "high"},
            {"minimal", "low", "moderate", "high", "critical", "unknown"},
        )
        if mapped:
            risk["risk_level"] = mapped
            mappings.append({"target": "/risk_profile/risk_level", "source": f"/{risk_key}", "mode": "enum_map"})
        else:
            warnings.append(f"Unrecognized risk value at /{risk_key}: {risk_value!r}")

    return result


def normalize_candidate(
    candidate: Candidate,
    path: str | Path,
    detection: Detection,
    source_hash: str | None = None,
) -> AdaptedRecord:
    p = Path(path)
    record = dict(candidate.record)
    record.pop("__axm_jsonl_line__", None)
    mappings: list[dict[str, Any]] = []
    inferences: list[dict[str, Any]] = []
    warnings: list[str] = []
    errors: list[str] = []

    if detection.format_id == "normalized_single" or (
        "capability_id" in record and "machine_name" in record
    ):
        normalized = dict(record)
        adapter_id = "normalized-source-v1"
        mappings.extend(
            [
                {"target": "/capability_id", "source": "/capability_id", "mode": "direct"},
                {"target": "/machine_name", "source": "/machine_name", "mode": "direct"},
            ]
        )
    else:
        adapter_id = "generic-manifest-v1"
        normalized: dict[str, Any] = {}

        capability_id, capability_id_key = _pick(record, ID_ALIASES)
        if capability_id_key:
            capability_id_text = _as_string(capability_id)
            if capability_id_text:
                normalized["capability_id"] = capability_id_text
                mappings.append({"target": "/capability_id", "source": f"/{capability_id_key}", "mode": "alias"})
        elif candidate.implied_id:
            normalized["capability_id"] = candidate.implied_id
            inferences.append({
                "field": "/capability_id",
                "rule": "container_key_as_capability_id",
                "source_pointer": candidate.pointer,
                "value": candidate.implied_id,
            })
        else:
            errors.append("No stable capability identifier was found. List records without IDs are rejected.")

        machine_name, machine_name_key = _pick(record, MACHINE_NAME_ALIASES)
        machine_name_text = _as_string(machine_name)
        if machine_name_text:
            normalized["machine_name"] = machine_name_text
            mappings.append({"target": "/machine_name", "source": f"/{machine_name_key}", "mode": "alias"})
        else:
            human_fallback, human_fallback_key = _pick(record, HUMAN_NAME_ALIASES)
            human_fallback_text = _as_string(human_fallback)
            if human_fallback_text:
                normalized["machine_name"] = _slug(human_fallback_text)
                inferences.append({
                    "field": "/machine_name",
                    "rule": "slug_from_human_display_name",
                    "source_field": f"/{human_fallback_key}",
                    "value": normalized["machine_name"],
                })
            elif normalized.get("capability_id"):
                normalized["machine_name"] = normalized["capability_id"]
                inferences.append({
                    "field": "/machine_name",
                    "rule": "capability_id_as_machine_name",
                    "source_field": "/capability_id",
                    "value": normalized["machine_name"],
                })
            else:
                errors.append("No machine name, display name, or usable ID was found.")

        scalar_fields = (
            ("revision", REVISION_ALIASES),
            ("human_name", HUMAN_NAME_ALIASES),
            ("description", DESCRIPTION_ALIASES),
            ("why_it_matters", WHY_ALIASES),
        )
        for target, aliases in scalar_fields:
            value, source_key = _pick(record, aliases)
            text = _as_string(value)
            if text is not None:
                normalized[target] = text
                mappings.append({"target": f"/{target}", "source": f"/{source_key}", "mode": "alias"})

        list_fields = {
            "category": ("category", "categories", "group", "domain"),
            "tags": ("tags", "labels", "keywords"),
            "examples": ("examples", "example_uses", "use_cases", "useCases"),
            "supported_task_types": ("supported_task_types", "task_types", "tasks"),
            "typical_goals": ("typical_goals", "goals", "outcomes"),
            "required_human_actions": ("required_human_actions", "human_actions"),
            "required_machine_actions": ("required_machine_actions", "machine_actions", "operations"),
            "collaboration_modes": ("collaboration_modes", "collaboration", "modes"),
            "aliases": ("aliases", "alternate_ids", "alternateIds", "legacy_ids", "legacyIds", "aka"),
        }
        for target, aliases in list_fields.items():
            value, source_key = _pick(record, aliases)
            if source_key:
                values = _as_list(value)
                if target == "collaboration_modes":
                    allowed = {"human_only", "ai_only", "human_ai_shared", "supervised_automation"}
                    rejected = [item for item in values if item not in allowed]
                    values = [item for item in values if item in allowed]
                    if rejected:
                        warnings.append(f"Ignored unsupported collaboration modes: {rejected}")
                normalized[target] = values
                mappings.append({"target": f"/{target}", "source": f"/{source_key}", "mode": "list_alias"})

        # AXM's generated public capability registry is intentionally sparse: it
        # declares provider/consumer routing and truth boundaries, while richer
        # module context lives in registry/modules.json + referenced module files.
        # Preserve that registry row as module-private evidence for a later exact
        # enrichment join; never squeeze module IDs into capability relationships.
        if record.get("schema") == AXM_PUBLIC_CAPABILITY_SCHEMA:
            adapter_id = "axm-public-capability-registry-v1"
            registry_role = classify_registry_role(record)
            normalized["registry_context"] = {
                "schema": AXM_PUBLIC_CAPABILITY_SCHEMA,
                "providers": _as_list(record.get("providers")),
                "consumers": _as_list(record.get("consumers")),
                "provider_statuses": [
                    dict(item) for item in record.get("provider_statuses", [])
                    if isinstance(item, dict)
                ],
                "truth": _copy_mapping(record.get("truth")),
                "registry_role": registry_role,
            }
            mappings.extend([
                {"target": "/registry_context/providers", "source": "/providers", "mode": "direct_context"},
                {"target": "/registry_context/consumers", "source": "/consumers", "mode": "direct_context"},
                {"target": "/registry_context/provider_statuses", "source": "/provider_statuses", "mode": "direct_context"},
                {"target": "/registry_context/truth", "source": "/truth", "mode": "direct_context"},
                {"target": "/registry_context/registry_role", "source": "/providers|/consumers", "mode": "deterministic_role_classification"},
            ])
        inputs = _copy_mapping(record.get("inputs"))
        if not inputs:
            inputs = {
                "input_types": _as_list(record.get("input_types") or record.get("accepts")),
                "required_inputs": _as_list(record.get("required_inputs")),
                "optional_inputs": _as_list(record.get("optional_inputs")),
                "input_constraints": _as_list(record.get("input_constraints")),
            }
            inputs = {key: value for key, value in inputs.items() if value}
        if inputs:
            normalized["inputs"] = inputs
            mappings.append({"target": "/inputs", "source": "/inputs|input aliases", "mode": "object_or_alias"})

        outputs = _copy_mapping(record.get("outputs"))
        if not outputs:
            outputs = {
                "output_types": _as_list(record.get("output_types") or record.get("produces")),
                "expected_outputs": _as_list(record.get("expected_outputs") or record.get("results")),
                "output_constraints": _as_list(record.get("output_constraints")),
            }
            outputs = {key: value for key, value in outputs.items() if value}
        if outputs:
            preview = outputs.get("preview_available")
            if preview not in {"KNOWN", "INFERRED", "UNKNOWN", "NOT_APPLICABLE"}:
                outputs["preview_available"] = "UNKNOWN"
            normalized["outputs"] = outputs
            mappings.append({"target": "/outputs", "source": "/outputs|output aliases", "mode": "object_or_alias"})

        normalized.update(_normalize_profiles(record, mappings, warnings))

        if record.get("schema") == AXM_PUBLIC_CAPABILITY_SCHEMA:
            # The public row explicitly says a declaration is not runtime proof
            # and grants no authority. Preserve those ceilings as direct source
            # facts instead of letting a generic "declared" label sound stronger.
            truth = _copy_mapping(record.get("truth"))
            maturity = _copy_mapping(normalized.get("maturity_profile"))
            limitations = _as_list(maturity.get("known_limitations"))
            if truth.get("declaration_is_runtime_proof") is False:
                maturity.setdefault("proof_status", "declared_not_runtime_proof")
                limitation = "Public capability declaration does not establish runtime behavior."
                if limitation not in limitations:
                    limitations.append(limitation)
                mappings.append({
                    "target": "/maturity_profile/proof_status",
                    "source": "/truth/declaration_is_runtime_proof",
                    "mode": "public_registry_proof_ceiling",
                })
            if truth.get("grants_authority") is False:
                limitation = "Public capability declaration grants no execution or control authority."
                if limitation not in limitations:
                    limitations.append(limitation)
            if limitations:
                maturity["known_limitations"] = limitations
                mappings.append({
                    "target": "/maturity_profile/known_limitations",
                    "source": "/truth",
                    "mode": "public_registry_truth_limitations",
                })
            if maturity:
                normalized["maturity_profile"] = maturity

        relationships = _copy_mapping(normalized.get("relationships"))
        relationship_aliases = {
            "dependency_capability_ids": ("dependency_capability_ids", "dependencies", "depends_on", "requires_capabilities"),
            "related_capability_ids": ("related_capability_ids", "related_capabilities", "related"),
            "alternative_capability_ids": ("alternative_capability_ids", "alternatives", "alternative_capabilities"),
            "commonly_combined_capability_ids": ("commonly_combined_capability_ids", "combined_with", "combinations"),
        }
        for target, aliases in relationship_aliases.items():
            if target in relationships:
                continue
            value, source_key = _pick(record, aliases)
            if source_key:
                relationships[target] = _as_list(value)
                mappings.append({"target": f"/relationships/{target}", "source": f"/{source_key}", "mode": "relationship_alias"})
        if relationships:
            normalized["relationships"] = relationships

        learning = _copy_mapping(normalized.get("learning_profile"))
        if "prerequisite_capability_ids" not in learning:
            prerequisites, prerequisite_key = _pick(record, ("prerequisite_capability_ids", "prerequisites", "requires_learning"))
            if prerequisite_key:
                learning["prerequisite_capability_ids"] = _as_list(prerequisites)
                mappings.append({"target": "/learning_profile/prerequisite_capability_ids", "source": f"/{prerequisite_key}", "mode": "relationship_alias"})
        if learning:
            normalized["learning_profile"] = learning

        lifecycle = _copy_mapping(normalized.get("lifecycle_profile"))
        deprecated, deprecated_key = _pick(record, ("deprecated", "is_deprecated"))
        status, status_key = _pick(record, ("lifecycle_status", "status", "state", "lifecycle"))
        if "status" not in lifecycle:
            mapped_status = None
            if deprecated_key and bool(deprecated):
                mapped_status = "deprecated"
            elif status_key:
                mapped_status = _map_enum(
                    status,
                    {
                        "production": "active",
                        "ready": "active",
                        "working": "active",
                        "enabled": "active",
                        "disabled": "retired",
                        "obsolete": "deprecated",
                    },
                    {"active", "deprecated", "replaced", "retired", "unknown"},
                )
            if mapped_status:
                lifecycle["status"] = mapped_status
                mappings.append({"target": "/lifecycle_profile/status", "source": f"/{deprecated_key or status_key}", "mode": "lifecycle_map"})

        lifecycle_aliases = {
            "replaces": ("replaces", "supersedes", "previous_capability_ids"),
            "replaced_by": ("replaced_by", "superseded_by", "replacement_capability_ids"),
        }
        for target, aliases in lifecycle_aliases.items():
            if target in lifecycle:
                lifecycle[target] = _as_list(lifecycle[target])
                continue
            value, source_key = _pick(record, aliases)
            if source_key:
                lifecycle[target] = _as_list(value)
                mappings.append({"target": f"/lifecycle_profile/{target}", "source": f"/{source_key}", "mode": "lifecycle_alias"})
        for target, aliases in {
            "deprecated_since": ("deprecated_since", "deprecation_date"),
            "reason": ("deprecation_reason", "lifecycle_reason", "retirement_reason"),
        }.items():
            if target in lifecycle:
                continue
            value, source_key = _pick(record, aliases)
            text = _as_string(value)
            if text is not None:
                lifecycle[target] = text
                mappings.append({"target": f"/lifecycle_profile/{target}", "source": f"/{source_key}", "mode": "lifecycle_alias"})
        if lifecycle:
            normalized["lifecycle_profile"] = lifecycle

        observed, observed_key = _pick(record, ("observed_evidence", "evidence", "test_evidence"))
        if observed_key and isinstance(observed, list):
            normalized["observed_evidence"] = [item for item in observed if isinstance(item, dict)]
            mappings.append({"target": "/observed_evidence", "source": f"/{observed_key}", "mode": "alias"})

    ref = _copy_mapping(normalized.get("source_reference"))
    if record.get("schema") == AXM_PUBLIC_CAPABILITY_SCHEMA:
        ref.setdefault("source_type", "registry")
    else:
        ref.setdefault("source_type", "registry" if "registry" in detection.format_id else "manifest")
    ref["source_location"] = str(p)
    ref["source_hash"] = source_hash or _source_hash(p)
    ref.setdefault("last_verified_at", datetime.now(timezone.utc).isoformat())
    ref.setdefault("confidence", detection.confidence)
    ref["source_pointer"] = candidate.pointer
    if "__axm_jsonl_line__" in candidate.record:
        ref["source_line"] = candidate.record["__axm_jsonl_line__"]
    ref["adapter_id"] = adapter_id
    ref["adapter_version"] = ADAPTER_VERSION
    ref["detected_format"] = detection.format_id
    normalized["source_reference"] = ref

    normalized["adapter_trace"] = {
        "adapter_id": adapter_id,
        "adapter_version": ADAPTER_VERSION,
        "detected_format": detection.format_id,
        "detection_confidence": detection.confidence,
        "source_pointer": candidate.pointer,
        "field_mappings": mappings,
        "inferences": inferences,
        "warnings": warnings,
    }

    if errors:
        return AdaptedRecord("rejected", candidate.pointer, adapter_id, None, errors, warnings, candidate.record)
    return AdaptedRecord("accepted", candidate.pointer, adapter_id, normalized, [], warnings, candidate.record)


def adapt_file(path: str | Path) -> tuple[Detection, list[AdaptedRecord]]:
    p = Path(path)
    document = load_source_document(p)
    detection = detect_document(document, p)
    candidates = extract_candidates(document)
    if detection.format_id == "jsonl_records" and isinstance(document, list):
        candidates = [
            Candidate(dict(item), f"/line/{item.get('__axm_jsonl_line__', index + 1)}")
            for index, item in enumerate(document)
            if isinstance(item, dict)
        ]
    if detection.format_id == "unknown":
        return detection, []
    file_hash = _source_hash(p)
    return detection, [normalize_candidate(candidate, p, detection, file_hash) for candidate in candidates]


def discover_source_files(path: str | Path, recursive: bool = True) -> list[Path]:
    p = Path(path)
    if p.is_symlink():
        raise ValueError(f"Source root may not be a symbolic link: {p}")
    if p.is_file():
        if p.suffix.lower() not in SUPPORTED_SUFFIXES:
            return []
        return [p]
    if not p.exists():
        raise FileNotFoundError(f"Source path not found: {p}")
    if not p.is_dir():
        raise ValueError(f"Source path is neither a regular file nor directory: {p}")
    iterator = p.rglob("*") if recursive else p.glob("*")
    supported: list[Path] = []
    for item in iterator:
        if item.suffix.lower() not in SUPPORTED_SUFFIXES:
            continue
        if item.is_symlink():
            raise ValueError(f"Capability source file may not be a symbolic link: {item}")
        if item.is_file():
            supported.append(item)
    return sorted(supported)
