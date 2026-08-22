"""Independent consumer for the Module One stable handoff anchor.

The consumer verifies the uploaded ZIP without importing or executing code from
that ZIP. It compares the producer's stable claims against Module Two's local
copy of the standalone shared contract and returns an explicit merge status.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
from pathlib import Path, PurePosixPath
import re
import stat
from typing import Any
from zipfile import ZipFile, ZipInfo

from .canonical import DuplicateKeyError, canonical_sha256, canonicalize, loads, loads_standard
from .util import CONTRACT_ROOT, stable_id
from .version import MODULE_ID, MODULE_VERSION

ANCHOR_REPORT_VERSION = "0.4.0"

# Bounded archive-consumption limits. The handoff anchor is policy/data, not a
# bulk transport channel. Limits prevent path-safe but resource-exhausting ZIPs
# from consuming unbounded memory or time during intake.
MAX_ARCHIVE_COMPRESSED_BYTES = 32 * 1024 * 1024
MAX_MEMBER_COUNT = 512
MAX_MEMBER_UNCOMPRESSED_BYTES = 8 * 1024 * 1024
MAX_TOTAL_UNCOMPRESSED_BYTES = 64 * 1024 * 1024
MAX_COMPRESSION_RATIO = 200.0
MAX_MEMBER_NAME_LENGTH = 512
EXPECTED_PACKAGE_ID = "axm.handoff.human-capability-atlas.stable-anchor"
EXPECTED_PACKAGE_VERSION = "0.1.0"
EXPECTED_MODULE_ID = "axm.module.human_capability_atlas"
EXPECTED_CONTRACT_ID = "axm.capability-interface-contract"
EXPECTED_CONTRACT_VERSION = "0.1.0"

REQUIRED_FILES = {
    "MODULE_IDENTITY.json",
    "FIELD_AUTHORITY_MAP.json",
    "CAPABILITY_IDENTITY_POLICY.md",
    "PROVENANCE_AND_HASH_POLICY.json",
    "EVIDENCE_STATE_POLICY.md",
    "PRODUCER_STATE_POLICY.md",
    "EXPORT_GUARANTEES.json",
    "COMPATIBILITY_POLICY.md",
    "STABLE_FIXTURE_INVARIANTS.json",
    "ATLAS_FIXTURE_RUN_EVIDENCE.json",
    "CANONICALIZATION_TEST_VECTORS.json",
    "atlas_stable_handoff_manifest.json",
    "VALIDATION_REPORT.md",
    "FILE_INVENTORY_SHA256.json",
}

EXPECTED_AUTHORITY_VALUES = {
    "SOURCE_AUTHORITATIVE",
    "ATLAS_EXPLANATORY",
    "SHARED_CONTRACT_OWNED",
    "DERIVED_WITH_EVIDENCE",
    "FORBIDDEN_TO_REDEFINE",
}

EXPECTED_GUARANTEE_IDS = {
    "canonical_schema_validation",
    "source_identity_preserved",
    "unknowns_explicit",
    "inferences_marked",
    "conflicts_preserved",
    "module_boundary",
    "no_private_contract_extension",
    "explanation_does_not_rewrite_source",
    "validation_failures_visible",
}

SCHEMA_COMPARISON_MAP = {
    "shared_capability.schema.json": "schemas/capability-interface-contract.schema.json",
    "interface_recommendation.schema.json": "schemas/interface-recommendation.schema.json",
    # The producer's source declaration schema is module-specific and has no
    # canonical counterpart in the standalone shared-contract v0.1.0 package.
    "source_capability.schema.json": None,
}


@dataclass(frozen=True)
class AnchorArchive:
    zip_path: Path
    zip_sha256: str
    root_name: str
    files: dict[str, bytes]
    warnings: list[str]


def _sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _safe_member_name(info: ZipInfo) -> PurePosixPath:
    name = info.filename.replace("\\", "/")
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError(f"Unsafe ZIP member path: {info.filename!r}")
    if info.flag_bits & 0x1:
        raise ValueError(f"Encrypted ZIP member is unsupported: {info.filename!r}")
    unix_mode = info.external_attr >> 16
    if unix_mode and stat.S_ISLNK(unix_mode):
        raise ValueError(f"Symbolic-link ZIP member is unsupported: {info.filename!r}")
    return path


def read_anchor_archive(path: str | Path) -> AnchorArchive:
    zip_path = Path(path)
    if not zip_path.is_file():
        raise ValueError(f"Anchor ZIP does not exist or is not a file: {zip_path}")
    compressed_size = zip_path.stat().st_size
    if compressed_size > MAX_ARCHIVE_COMPRESSED_BYTES:
        raise ValueError(
            f"Anchor ZIP exceeds compressed-size limit: {compressed_size} > "
            f"{MAX_ARCHIVE_COMPRESSED_BYTES} bytes"
        )
    raw_zip = zip_path.read_bytes()
    if len(raw_zip) > MAX_ARCHIVE_COMPRESSED_BYTES:
        raise ValueError(
            f"Anchor ZIP grew beyond compressed-size limit while reading: {len(raw_zip)} > "
            f"{MAX_ARCHIVE_COMPRESSED_BYTES} bytes"
        )

    members: dict[str, bytes] = {}
    roots: set[str] = set()
    warnings: list[str] = []
    total_uncompressed = 0

    with ZipFile(BytesIO(raw_zip)) as archive:
        infos = archive.infolist()
        if len(infos) > MAX_MEMBER_COUNT:
            raise ValueError(
                f"Anchor ZIP exceeds member-count limit: {len(infos)} > {MAX_MEMBER_COUNT}"
            )
        seen_full_names: set[str] = set()
        for info in infos:
            if len(info.filename) > MAX_MEMBER_NAME_LENGTH:
                raise ValueError(
                    f"ZIP member name exceeds {MAX_MEMBER_NAME_LENGTH} characters: "
                    f"{info.filename[:80]!r}"
                )
            safe_path = _safe_member_name(info)
            if not safe_path.parts:
                continue
            full_name = safe_path.as_posix()
            if full_name in seen_full_names:
                raise ValueError(f"Duplicate ZIP member: {full_name}")
            seen_full_names.add(full_name)
            roots.add(safe_path.parts[0])
            if info.is_dir():
                continue
            if info.file_size > MAX_MEMBER_UNCOMPRESSED_BYTES:
                raise ValueError(
                    f"ZIP member exceeds uncompressed-size limit: {full_name} "
                    f"({info.file_size} > {MAX_MEMBER_UNCOMPRESSED_BYTES} bytes)"
                )
            total_uncompressed += info.file_size
            if total_uncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES:
                raise ValueError(
                    "Anchor ZIP exceeds total uncompressed-size limit: "
                    f"{total_uncompressed} > {MAX_TOTAL_UNCOMPRESSED_BYTES} bytes"
                )
            if info.file_size and info.compress_size == 0:
                raise ValueError(f"Invalid zero compressed size for non-empty ZIP member: {full_name}")
            if info.compress_size:
                ratio = info.file_size / info.compress_size
                if ratio > MAX_COMPRESSION_RATIO:
                    raise ValueError(
                        f"ZIP member compression ratio exceeds limit: {full_name} "
                        f"({ratio:.1f} > {MAX_COMPRESSION_RATIO:.1f})"
                    )
            if len(safe_path.parts) < 2:
                raise ValueError("Anchor files must live under one package root directory.")
            relative = PurePosixPath(*safe_path.parts[1:]).as_posix()
            if relative in members:
                raise ValueError(f"Duplicate relative anchor path: {relative}")
            payload = archive.read(info)
            if len(payload) != info.file_size:
                raise ValueError(
                    f"ZIP member size changed during read: {full_name} "
                    f"({len(payload)} != {info.file_size})"
                )
            members[relative] = payload

    if len(roots) != 1:
        raise ValueError(f"Expected exactly one ZIP package root, found {sorted(roots)}")
    root_name = next(iter(roots))
    if any(name.startswith("__pycache__/") or name.endswith(".pyc") for name in members):
        warnings.append("Archive contains compiled Python cache files that are not required for the handoff.")
    return AnchorArchive(
        zip_path=zip_path,
        zip_sha256=_sha256(raw_zip),
        root_name=root_name,
        files=members,
        warnings=warnings,
    )


def _json_file(archive: AnchorArchive, relative: str) -> Any:
    payload = archive.files.get(relative)
    if payload is None:
        raise KeyError(f"Missing anchor file: {relative}")
    return loads_standard(payload.decode("utf-8"))


def _text_file(archive: AnchorArchive, relative: str) -> str:
    payload = archive.files.get(relative)
    if payload is None:
        raise KeyError(f"Missing anchor file: {relative}")
    return payload.decode("utf-8")


def _load_local_schema(relative: str) -> dict[str, Any]:
    path = CONTRACT_ROOT / relative
    return loads_standard(path.read_text(encoding="utf-8"))


def local_schema_hashes() -> dict[str, str]:
    result: dict[str, str] = {}
    schema_dir = CONTRACT_ROOT / "schemas"
    for path in sorted(schema_dir.glob("*.json")):
        result[path.name] = _sha256(path.read_bytes())
    return result


def _finding(
    finding_id: str,
    status: str,
    severity: str,
    summary: str,
    *,
    evidence: Any | None = None,
    required_action: str = "",
) -> dict[str, Any]:
    item = {
        "id": finding_id,
        "status": status,
        "severity": severity,
        "summary": summary,
    }
    if evidence is not None:
        item["evidence"] = evidence
    if required_action:
        item["required_action"] = required_action
    return item


def _inventory_check(archive: AnchorArchive, inventory: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    declared: set[str] = set()
    for entry in inventory.get("files", []):
        relative = entry.get("path")
        if not isinstance(relative, str):
            errors.append("Inventory entry without a string path.")
            continue
        declared.add(relative)
        payload = archive.files.get(relative)
        if payload is None:
            errors.append(f"Inventory file missing from ZIP: {relative}")
            continue
        if len(payload) != entry.get("bytes"):
            errors.append(
                f"Byte-size mismatch for {relative}: declared {entry.get('bytes')}, actual {len(payload)}"
            )
        actual_hash = _sha256(payload)
        if actual_hash != entry.get("sha256"):
            errors.append(
                f"SHA-256 mismatch for {relative}: declared {entry.get('sha256')}, actual {actual_hash}"
            )

    allowed_unlisted = {"FILE_INVENTORY_SHA256.json"}
    extras = sorted(set(archive.files) - declared - allowed_unlisted)
    substantive_extras = [
        path for path in extras if not path.startswith("__pycache__/") and not path.endswith(".pyc")
    ]
    if substantive_extras:
        errors.append(f"Unlisted substantive files in ZIP: {substantive_extras}")
    return {
        "status": "PASS" if not errors else "FAIL",
        "errors": errors,
        "unlisted_nonblocking_files": [path for path in extras if path not in substantive_extras],
        "declared_file_count": len(declared),
    }


def _extract_state_mapping(policy_text: str) -> dict[str, str]:
    mapping: dict[str, str] = {}
    pattern = re.compile(r"^\|\s*(KNOWN|INFERRED|UNKNOWN|CONFLICTED|NOT_APPLICABLE)\s*\|\s*`([^`]+)`\s*\|$")
    for line in policy_text.splitlines():
        match = pattern.match(line.strip())
        if match:
            mapping[match.group(1)] = match.group(2)
    return mapping


def _local_state_tokens() -> dict[str, list[str]]:
    evidence_schema = _load_local_schema("schemas/evidence-annotation.schema.json")
    capability_schema = _load_local_schema("schemas/capability-interface-contract.schema.json")
    return {
        "evidence_annotation.state": evidence_schema["properties"]["state"]["enum"],
        "output_profile.preview_available": capability_schema["properties"]["output_profile"]["properties"]["preview_available"]["enum"],
    }


def _run_canonicalization_vectors(vectors_doc: dict[str, Any]) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    for vector in vectors_doc.get("vectors", []):
        vector_id = vector.get("id", "")
        if vector_id == "unicode_key_normalization_collision":
            try:
                canonicalize({"é": 1, "e\u0301": 2})
            except DuplicateKeyError as exc:
                results.append({
                    "id": vector_id,
                    "status": "PASS",
                    "detail": str(exc),
                })
            else:
                results.append({
                    "id": vector_id,
                    "status": "FAIL",
                    "detail": "Normalization collision was not rejected.",
                })
            continue

        try:
            value = loads(vector["input_json"])
            actual_canonical = canonicalize(value)
            actual_hash = canonical_sha256(value)
            expected_canonical = vector.get("expected_canonical")
            expected_hash = vector.get("canonical_sha256")
            status = "PASS" if actual_canonical == expected_canonical and actual_hash == expected_hash else "FAIL"
            results.append({
                "id": vector_id,
                "status": status,
                "expected_canonical": expected_canonical,
                "actual_canonical": actual_canonical,
                "expected_sha256": expected_hash,
                "actual_sha256": actual_hash,
            })
        except Exception as exc:  # deterministic report, not silent failure
            results.append({"id": vector_id, "status": "FAIL", "detail": str(exc)})
    return {
        "profile": vectors_doc.get("canonicalization_profile"),
        "profile_version": vectors_doc.get("profile_version"),
        "status": "PASS" if results and all(item["status"] == "PASS" for item in results) else "FAIL",
        "results": results,
    }


def _schema_comparison(manifest: dict[str, Any]) -> list[dict[str, Any]]:
    declared = manifest.get("shared_schema_sha256_hashes", {})
    comparisons: list[dict[str, Any]] = []
    for producer_name, local_relative in SCHEMA_COMPARISON_MAP.items():
        producer_info = declared.get(producer_name)
        if not isinstance(producer_info, dict):
            comparisons.append({
                "producer_schema": producer_name,
                "local_schema": local_relative,
                "status": "MISSING_DECLARATION",
                "producer_sha256": "",
                "local_sha256": "",
            })
            continue
        producer_hash = producer_info.get("sha256", "")
        if local_relative is None:
            comparisons.append({
                "producer_schema": producer_name,
                "local_schema": None,
                "status": "NO_CANONICAL_COUNTERPART",
                "producer_sha256": producer_hash,
                "local_sha256": "",
                "note": "Module One source-declaration schema is not part of the standalone shared-contract v0.1.0 package.",
            })
            continue
        local_path = CONTRACT_ROOT / local_relative
        local_hash = _sha256(local_path.read_bytes())
        comparisons.append({
            "producer_schema": producer_name,
            "local_schema": local_relative,
            "status": "MATCH" if producer_hash == local_hash else "MISMATCH",
            "producer_sha256": producer_hash,
            "local_sha256": local_hash,
        })

    declared_names = set(declared)
    if "evidence_annotation.schema.json" not in declared_names:
        local_path = CONTRACT_ROOT / "schemas/evidence-annotation.schema.json"
        comparisons.append({
            "producer_schema": None,
            "local_schema": "schemas/evidence-annotation.schema.json",
            "status": "UNDECLARED_BY_PRODUCER",
            "producer_sha256": "",
            "local_sha256": _sha256(local_path.read_bytes()),
            "note": "The producer anchor did not fingerprint the canonical evidence-annotation schema used by Module Two.",
        })
    return comparisons


def _fixture_summary(
    invariants: dict[str, Any],
    evidence: dict[str, Any],
) -> dict[str, Any]:
    invariant_items = invariants.get("fixtures", [])
    evidence_items = evidence.get("records", [])
    invariant_ids = [item.get("capability_id") for item in invariant_items]
    evidence_ids = [item.get("capability_id") for item in evidence_items]
    duplicate_invariants = sorted({value for value in invariant_ids if invariant_ids.count(value) > 1 and value})
    duplicate_evidence = sorted({value for value in evidence_ids if evidence_ids.count(value) > 1 and value})
    missing_evidence = sorted(set(invariant_ids) - set(evidence_ids))
    unexpected_evidence = sorted(set(evidence_ids) - set(invariant_ids))
    policy_pass = sum(
        1 for item in evidence_items
        if item.get("validation", {}).get("stable_anchor_evidence_policy") == "PASS"
    )
    policy_fail = sum(
        1 for item in evidence_items
        if item.get("validation", {}).get("stable_anchor_evidence_policy") == "FAIL"
    )
    schema_fail = sum(
        1 for item in evidence_items
        if item.get("validation", {}).get("shared_capability_schema") != "PASS"
    )
    invariant_fail = sum(
        1 for item in evidence_items
        if item.get("validation", {}).get("stable_fixture_invariants") != "PASS"
    )
    identity_consistent = not (duplicate_invariants or duplicate_evidence or missing_evidence or unexpected_evidence)
    return {
        "declared_fixture_count": invariants.get("fixture_count"),
        "invariant_record_count": len(invariant_items),
        "run_evidence_count": len(evidence_items),
        "identity_set_status": "PASS" if identity_consistent else "FAIL",
        "duplicate_invariant_ids": duplicate_invariants,
        "duplicate_run_evidence_ids": duplicate_evidence,
        "missing_run_evidence_ids": missing_evidence,
        "unexpected_run_evidence_ids": unexpected_evidence,
        "shared_schema_failures": schema_fail,
        "stable_invariant_failures": invariant_fail,
        "stable_evidence_policy": {
            "PASS": policy_pass,
            "FAIL": policy_fail,
            "status": "PASS" if policy_fail == 0 and policy_pass == len(evidence_items) else "PARTIAL",
        },
    }


def evaluate_anchor(
    path: str | Path,
    *,
    generated_at: str | None = None,
) -> dict[str, Any]:
    timestamp = generated_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    findings: list[dict[str, Any]] = []

    try:
        archive = read_anchor_archive(path)
    except Exception as exc:
        return {
            "report_version": ANCHOR_REPORT_VERSION,
            "report_id": stable_id("axm.hii.anchor-gate", {"path": str(path), "error": str(exc)}),
            "generated_at": timestamp,
            "overall_status": "FAIL",
            "strict_merge_status": "BLOCKED",
            "recommendation_execution_state": "NOT_RUN",
            "findings": [
                _finding(
                    "anchor_archive_unreadable",
                    "FAIL",
                    "critical",
                    "The Module One anchor archive could not be read safely.",
                    evidence=str(exc),
                    required_action="Provide a readable, non-encrypted ZIP with one safe package root.",
                )
            ],
        }

    missing = sorted(REQUIRED_FILES - set(archive.files))
    if missing:
        findings.append(_finding(
            "required_files",
            "FAIL",
            "critical",
            "The anchor is missing required stable handoff files.",
            evidence=missing,
            required_action="Regenerate the anchor with every required stable file.",
        ))
        return {
            "report_version": ANCHOR_REPORT_VERSION,
            "report_id": stable_id("axm.hii.anchor-gate", {"zip_sha256": archive.zip_sha256, "missing": missing}),
            "generated_at": timestamp,
            "anchor_zip_sha256": archive.zip_sha256,
            "anchor_root": archive.root_name,
            "overall_status": "FAIL",
            "strict_merge_status": "BLOCKED",
            "recommendation_execution_state": "NOT_RUN",
            "findings": findings,
        }

    try:
        manifest = _json_file(archive, "atlas_stable_handoff_manifest.json")
        module_identity = _json_file(archive, "MODULE_IDENTITY.json")
        authority_map = _json_file(archive, "FIELD_AUTHORITY_MAP.json")
        guarantees = _json_file(archive, "EXPORT_GUARANTEES.json")
        inventory = _json_file(archive, "FILE_INVENTORY_SHA256.json")
        invariants = _json_file(archive, "STABLE_FIXTURE_INVARIANTS.json")
        run_evidence = _json_file(archive, "ATLAS_FIXTURE_RUN_EVIDENCE.json")
        vectors = _json_file(archive, "CANONICALIZATION_TEST_VECTORS.json")
        evidence_policy_text = _text_file(archive, "EVIDENCE_STATE_POLICY.md")
    except (KeyError, UnicodeDecodeError, json.JSONDecodeError, DuplicateKeyError, ValueError) as exc:
        findings.append(_finding(
            "anchor_parse",
            "FAIL",
            "critical",
            "One or more required anchor files could not be parsed deterministically.",
            evidence=str(exc),
            required_action="Repair malformed JSON or invalid UTF-8 and regenerate the inventory.",
        ))
        return {
            "report_version": ANCHOR_REPORT_VERSION,
            "report_id": stable_id("axm.hii.anchor-gate", {"zip_sha256": archive.zip_sha256, "parse_error": str(exc)}),
            "generated_at": timestamp,
            "anchor_zip_sha256": archive.zip_sha256,
            "anchor_root": archive.root_name,
            "overall_status": "FAIL",
            "strict_merge_status": "BLOCKED",
            "recommendation_execution_state": "NOT_RUN",
            "findings": findings,
        }

    inventory_result = _inventory_check(archive, inventory)
    if inventory_result["status"] == "PASS":
        findings.append(_finding(
            "package_inventory",
            "PASS",
            "info",
            "All inventory-declared anchor files match their byte sizes and SHA-256 hashes.",
            evidence=inventory_result,
        ))
    else:
        findings.append(_finding(
            "package_inventory",
            "FAIL",
            "critical",
            "Anchor package inventory verification failed.",
            evidence=inventory_result,
            required_action="Regenerate the anchor and inventory from unchanged source files.",
        ))

    for warning in archive.warnings:
        findings.append(_finding(
            "archive_hygiene",
            "WARN",
            "low",
            warning,
            required_action="Exclude __pycache__ and .pyc files from the next package; they are not needed for intake.",
        ))

    identity_checks = {
        "package_identifier": manifest.get("package_identifier") == EXPECTED_PACKAGE_ID,
        "package_version": manifest.get("package_version") == EXPECTED_PACKAGE_VERSION,
        "atlas_module_identifier": manifest.get("atlas_module_identifier") == EXPECTED_MODULE_ID,
        "module_identity_identifier": module_identity.get("stable_module_identifier") == EXPECTED_MODULE_ID,
        "contract_identifier": manifest.get("shared_contract", {}).get("identifier") == EXPECTED_CONTRACT_ID,
        "contract_version": manifest.get("shared_contract", {}).get("version") == EXPECTED_CONTRACT_VERSION,
        "module_contract_version": module_identity.get("shared_contract", {}).get("version_consumed") == EXPECTED_CONTRACT_VERSION,
    }
    if all(identity_checks.values()):
        findings.append(_finding(
            "stable_identity",
            "PASS",
            "info",
            "Package, module, and shared-contract identifiers match the expected stable handshake identities.",
            evidence=identity_checks,
        ))
    else:
        findings.append(_finding(
            "stable_identity",
            "FAIL",
            "critical",
            "One or more stable package, module, or contract identifiers do not match.",
            evidence=identity_checks,
            required_action="Repair the identifier mismatch without silently changing either module's identity.",
        ))

    authority_values = set(authority_map.get("authority_values", {}))
    unknown_authorities = sorted(authority_values - EXPECTED_AUTHORITY_VALUES)
    missing_authorities = sorted(EXPECTED_AUTHORITY_VALUES - authority_values)
    if not unknown_authorities and not missing_authorities:
        findings.append(_finding(
            "authority_enums",
            "PASS",
            "info",
            "Field authority vocabulary matches the requested stable set.",
        ))
    else:
        findings.append(_finding(
            "authority_enums",
            "FAIL",
            "high",
            "Field authority vocabulary is incomplete or privately extended.",
            evidence={"missing": missing_authorities, "unknown": unknown_authorities},
            required_action="Use only the agreed authority values or raise a shared-contract change request.",
        ))

    local_capability_schema = _load_local_schema("schemas/capability-interface-contract.schema.json")
    local_top_level_fields = set(local_capability_schema.get("properties", {}))
    authority_roots = {
        key.split(".", 1)[0]
        for key in authority_map.get("fields", {})
        if key != "module_two_interface_recommendation"
    }
    authority_only_fields = sorted(authority_roots - local_top_level_fields)
    if authority_only_fields:
        findings.append(_finding(
            "authority_map_contract_fields",
            "CONFLICTED",
            "critical",
            "The anchor declares shared-contract-owned fields that are absent from Module Two's standalone contract v0.1.0 schema.",
            evidence={"anchor_only_top_level_fields": authority_only_fields},
            required_action="Do not treat these as stable v0.1.0 fields. Reconcile against the standalone contract or submit a versioned shared-contract change request.",
        ))
    else:
        findings.append(_finding(
            "authority_map_contract_fields",
            "PASS",
            "info",
            "Every authority-map field root exists in Module Two's local standalone contract schema.",
        ))

    guarantee_ids = {item.get("id") for item in guarantees.get("guarantees", [])}
    missing_guarantees = sorted(EXPECTED_GUARANTEE_IDS - guarantee_ids)
    if not missing_guarantees:
        findings.append(_finding(
            "export_guarantees",
            "PASS",
            "info",
            "The requested stable export guarantees are present.",
        ))
    else:
        findings.append(_finding(
            "export_guarantees",
            "FAIL",
            "high",
            "One or more required export guarantees are missing.",
            evidence=missing_guarantees,
            required_action="Add the missing guarantee without weakening existing guarantees.",
        ))

    schema_comparison = _schema_comparison(manifest)
    schema_mismatches = [item for item in schema_comparison if item["status"] == "MISMATCH"]
    if schema_mismatches:
        findings.append(_finding(
            "shared_schema_byte_identity",
            "CONFLICTED",
            "critical",
            "The same shared-contract version is represented by different schema bytes in Module One and Module Two.",
            evidence=schema_mismatches,
            required_action="Module One must consume the exact standalone shared-contract v0.1.0 schema files, or both modules must approve a new contract version. Do not normalize this mismatch silently.",
        ))
    else:
        findings.append(_finding(
            "shared_schema_byte_identity",
            "PASS",
            "info",
            "Comparable shared schema hashes match byte-for-byte.",
        ))

    state_mapping = _extract_state_mapping(evidence_policy_text)
    local_tokens = _local_state_tokens()
    producer_tokens = [state_mapping.get(name, "") for name in ["KNOWN", "INFERRED", "UNKNOWN", "CONFLICTED", "NOT_APPLICABLE"]]
    token_conflicts = {
        location: {"producer": producer_tokens, "module_two": tokens}
        for location, tokens in local_tokens.items()
        if producer_tokens and producer_tokens != tokens
    }
    if token_conflicts:
        findings.append(_finding(
            "evidence_state_serialization",
            "CONFLICTED",
            "critical",
            "Module One and Module Two serialize the same evidence-state semantics with different tokens under contract version 0.1.0.",
            evidence=token_conflicts,
            required_action="Use the exact standalone v0.1.0 contract serialization. A semantic mapping may be documented for diagnostics but must not rewrite records silently.",
        ))
    else:
        findings.append(_finding(
            "evidence_state_serialization",
            "PASS",
            "info",
            "Evidence-state serialization tokens match the local standalone contract schema.",
        ))

    canonicalization = _run_canonicalization_vectors(vectors)
    if canonicalization["status"] == "PASS":
        findings.append(_finding(
            "canonicalization_vectors",
            "PASS",
            "info",
            "Module Two's independent AXM-CJ-1 implementation reproduces all supplied test vectors.",
            evidence={"vector_count": len(canonicalization["results"])},
        ))
    else:
        findings.append(_finding(
            "canonicalization_vectors",
            "FAIL",
            "critical",
            "Module Two could not reproduce one or more AXM-CJ-1 vectors.",
            evidence=canonicalization,
            required_action="Resolve canonicalization before comparing record hashes.",
        ))

    fixture_summary = _fixture_summary(invariants, run_evidence)
    expected_fixture_set_present = (
        fixture_summary["declared_fixture_count"] == 10
        and fixture_summary["invariant_record_count"] == 10
        and fixture_summary["run_evidence_count"] == 10
    )
    if expected_fixture_set_present and fixture_summary["identity_set_status"] == "PASS" and not fixture_summary["shared_schema_failures"] and not fixture_summary["stable_invariant_failures"]:
        findings.append(_finding(
            "fixture_identity_and_run_evidence",
            "PASS",
            "info",
            "All ten stable fixture identities have Atlas run evidence and passed the producer's current schema and invariant checks.",
            evidence=fixture_summary,
        ))
    else:
        findings.append(_finding(
            "fixture_identity_and_run_evidence",
            "FAIL",
            "high",
            "Fixture identity, schema, or invariant evidence is incomplete or failing.",
            evidence=fixture_summary,
            required_action="Repair the fixture evidence set before using it as a paired regression gate.",
        ))

    evidence_fail_count = fixture_summary["stable_evidence_policy"]["FAIL"]
    if evidence_fail_count:
        findings.append(_finding(
            "strict_evidence_policy",
            "PARTIAL",
            "high",
            f"{evidence_fail_count} of {fixture_summary['run_evidence_count']} Atlas fixture outputs fail the anchor's own strict inference-metadata policy.",
            evidence=fixture_summary["stable_evidence_policy"],
            required_action="Keep those inferred values non-authoritative. Align Atlas output with the accepted shared contract; do not add private fields to force a pass.",
        ))
    else:
        findings.append(_finding(
            "strict_evidence_policy",
            "PASS",
            "info",
            "All fixture outputs conform to the anchor's strict evidence policy.",
        ))

    local_evidence_props = set(
        _load_local_schema("schemas/evidence-annotation.schema.json").get("properties", {})
    )
    policy_lower = evidence_policy_text.lower()
    representability_gaps: list[dict[str, str]] = []
    if "evidence reference" in policy_lower and "evidence_reference" not in local_evidence_props:
        representability_gaps.append({
            "requirement": "evidence reference",
            "local_schema_support": "No dedicated evidence_reference field; additional properties are forbidden."
        })
    if "producer/build identity" in policy_lower or "producer identity" in policy_lower or "build identity" in policy_lower:
        representability_gaps.append({
            "requirement": "producer/build identity for machine-generated inference",
            "local_schema_support": "No dedicated producer or build identity field in evidence annotations; additional properties are forbidden."
        })
    if representability_gaps:
        findings.append(_finding(
            "strict_inference_metadata_representability",
            "CONFLICTED",
            "critical",
            "The anchor declares mandatory inference metadata that Module Two's accepted v0.1.0 evidence schema cannot represent directly because additional properties are forbidden.",
            evidence={
                "gaps": representability_gaps,
                "local_evidence_fields": sorted(local_evidence_props),
            },
            required_action="Treat the extra metadata as a proposed shared-contract change, not a stable v0.1.0 guarantee. Do not privately extend either module's schema.",
        ))

    critical_blockers = [
        item for item in findings
        if item["severity"] == "critical" and item["status"] in {"FAIL", "CONFLICTED"}
    ]
    high_policy_holds = [
        item for item in findings
        if item["severity"] == "high" and item["status"] in {"FAIL", "CONFLICTED", "PARTIAL"}
    ]
    if critical_blockers:
        overall = "CONFLICTED"
        strict_merge = "BLOCKED"
    elif high_policy_holds:
        overall = "TEST-HOLD-REVIEW"
        strict_merge = "BLOCKED"
    else:
        overall = "PASS"
        strict_merge = "PASS"

    report_core = {
        "anchor_zip_sha256": archive.zip_sha256,
        "module_two_contract_hashes": local_schema_hashes(),
        "strict_merge_status": strict_merge,
        "critical_finding_ids": [item["id"] for item in critical_blockers],
    }
    return {
        "report_version": ANCHOR_REPORT_VERSION,
        "report_id": stable_id("axm.hii.anchor-gate", report_core),
        "generated_at": timestamp,
        "module_two": {
            "module_id": MODULE_ID,
            "module_version": MODULE_VERSION,
            "contract_id": EXPECTED_CONTRACT_ID,
            "contract_version": EXPECTED_CONTRACT_VERSION,
        },
        "inspected_anchor": {
            "zip_path_name": archive.zip_path.name,
            "zip_sha256": archive.zip_sha256,
            "root_name": archive.root_name,
            "package_identifier": manifest.get("package_identifier"),
            "package_version": manifest.get("package_version"),
            "atlas_module_identifier": manifest.get("atlas_module_identifier"),
            "atlas_version": manifest.get("atlas_version"),
            "atlas_build_identifier": manifest.get("atlas_build_identifier"),
            "producer_execution_state": manifest.get("producer_execution_state"),
        },
        "overall_status": overall,
        "strict_merge_status": strict_merge,
        "safe_record_analysis_status": "NOT_RUN",
        "recommendation_execution_state": "NOT_RUN",
        "safe_record_analysis_reason": "The stable anchor contains fixture hashes and policies, not the full Atlas Capability Records. Schema identity must also be reconciled before paired record intake.",
        "inventory": inventory_result,
        "schema_comparison": schema_comparison,
        "evidence_state_mapping_declared_by_anchor": state_mapping,
        "local_evidence_state_tokens": local_tokens,
        "canonicalization": canonicalization,
        "fixture_summary": fixture_summary,
        "findings": findings,
        "merge_rule": "Any critical identity, schema, serialization, provenance, or representability conflict blocks paired merge. No recommendation was generated from the anchor alone.",
    }
