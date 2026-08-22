#!/usr/bin/env python3
"""Build the Workshop-wide human-usability guidance catalog.

The catalog is advisory TEST material. It applies Module 1 to make each
registered module understandable, Module 2 to recommend a fitting interface,
and Module 3 to retain unresolved usability gaps without gaining authority.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
WORKSHOP = HERE.parents[1]
MODULE1 = WORKSHOP / "tools" / "human-capability-atlas" / "engine"
MODULE2 = WORKSHOP / "tools" / "human-interface-intelligence" / "engine"
MODULE3 = WORKSHOP / "tools" / "grounded-evolution-intelligence" / "engine"
TOOLS_INDEX = WORKSHOP / "tools-index.json"
DEFAULT_OUTPUT = HERE / "generated" / "platform-usability"
GENERATED_AT = "2026-08-09T12:00:00Z"
CATALOG_SCHEMA = "axm.platform-human-usability-catalog/v1"
RECEIPT_SCHEMA = "axm.platform-human-usability-coverage-receipt/v1"

for path in (MODULE1 / "src", MODULE2, HERE):
    value = str(path)
    if value not in sys.path:
        sys.path.insert(0, value)

from axm_capability_atlas.atlas import build_card  # noqa: E402
from axm_capability_atlas.validators import validate_card  # noqa: E402
from axm_hii.assurance import build_recommendation_assurance  # noqa: E402
from axm_hii.engine import recommend_interface  # noqa: E402
from trio import adapt_capability_record, digest_value  # noqa: E402
from world_interface_adapter import build_impact_map, load_world_state, world_context_for_module  # noqa: E402


TASK_PATTERNS: list[tuple[str, tuple[str, ...], list[str], list[str], list[str]]] = [
    (
        "monitoring",
        ("monitor", "status", "observe", "metric", "telemetry", "heartbeat", "pulse", "health", "log"),
        ["events", "metrics", "logs"],
        ["status", "progress", "alerts"],
        ["progress", "logs", "pause", "stop", "alert"],
    ),
    (
        "long_running_automation",
        ("automation", "scheduler", "scheduled", "recipe", "repeated workflow", "orchestrat*"),
        ["trigger", "conditions", "actions", "schedule"],
        ["recipe", "run_status", "logs"],
        ["trigger", "conditions", "actions", "test_run", "logs"],
    ),
    (
        "game_controller_input",
        ("game", "controller", "play", "multiplayer", "simulation control"),
        ["controller", "keyboard", "touch_controls"],
        ["movement", "simulation_state"],
        ["input_map", "pause", "feedback"],
    ),
    (
        "media_editing",
        ("film", "video", "audio", "music", "animation", "timeline", "media", "sound"),
        ["events", "clips", "keyframes"],
        ["sequence", "media", "preview"],
        ["tracks", "scrubber", "zoom", "playback", "undo"],
    ),
    (
        "drawing",
        ("draw", "drawing", "canvas", "illustration", "paint", "sprite", "vector", "pixel", "visual studio", "spatial design"),
        ["pointer", "touch", "objects"],
        ["image", "layout", "scene"],
        ["canvas", "zoom", "pan", "undo", "layers"],
    ),
    (
        "image_editing",
        ("image", "photo", "texture", "composit*", "background replacement"),
        ["image", "parameters", "pointer"],
        ["visual_preview", "artifact"],
        ["preview", "controls", "before_after", "undo", "apply"],
    ),
    (
        "data_analysis",
        ("data", "table", "spreadsheet", "analysis", "finance", "economic", "chart"),
        ["rows", "columns", "numbers"],
        ["table", "chart", "analysis"],
        ["table", "sort", "filter", "formula", "undo"],
    ),
    (
        "mapping",
        ("map", "geographic", "spatial", "location", "route", "world room"),
        ["coordinates", "locations", "routes"],
        ["map", "route", "area"],
        ["map", "search", "markers", "route", "layers"],
    ),
    (
        "software_build",
        ("code", "coding", "software", "build", "forge", "generator", "developer", "package"),
        ["mixed", "structured"],
        ["result", "status", "summary"],
        ["progress", "back", "next", "review", "confirm"],
    ),
    (
        "planning",
        ("plan", "planning", "project", "brainstorm", "conversation", "chat", "agent", "team", "collaborat*"),
        ["text", "files"],
        ["text", "plan", "draft"],
        ["history", "clarification", "preview", "explicit_execute"],
    ),
    (
        "structured_configuration",
        ("config*", "setting", "settings", "setup", "adapter", "profile", "parameter", "parameters", "intake"),
        ["text", "choice", "parameters"],
        ["record", "preview", "result"],
        ["validation", "defaults", "help_text", "preview"],
    ),
    (
        "browse",
        ("search", "browse", "catalog", "library", "discovery", "archive", "registry", "atlas", "knowledge"),
        ["query", "filters"],
        ["list", "preview", "metadata"],
        ["search", "filters", "preview", "metadata"],
    ),
]


def _canonical_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def _sha_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha_file(path: Path) -> str:
    return _sha_bytes(path.read_bytes())


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")


def _portable(path: Path) -> str:
    return path.relative_to(WORKSHOP).as_posix()


def _clean_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _sentence(value: str) -> str:
    text = " ".join(str(value or "").split()).strip()
    if not text:
        return text
    text = text[0].upper() + text[1:]
    return text if text.endswith((".", "!", "?")) else text + "."


def _task_profile(manifest: dict[str, Any]) -> dict[str, Any]:
    fields = [
        manifest.get("id", ""),
        manifest.get("name", ""),
        manifest.get("category", ""),
        manifest.get("summary", ""),
        manifest.get("notes", ""),
        " ".join(_clean_list(manifest.get("tags"))),
        " ".join(_clean_list(manifest.get("actions"))),
        " ".join(_clean_list(manifest.get("accepts"))),
        " ".join(_clean_list(manifest.get("produces"))),
    ]
    haystack = " ".join(str(field) for field in fields).lower()
    normalized = " " + re.sub(r"[^a-z0-9]+", " ", haystack).strip() + " "
    ranked: list[tuple[int, int, str, list[str], list[str], list[str]]] = []
    for order, (task_type, needles, inputs, outputs, controls) in enumerate(TASK_PATTERNS):
        score = 0
        for needle in needles:
            clean = re.sub(r"[^a-z0-9 ]+", "", needle.rstrip("*").lower()).strip()
            if not clean:
                continue
            if needle.endswith("*"):
                matched = re.search(r"(?:^| )" + re.escape(clean) + r"[a-z0-9]*(?: |$)", normalized) is not None
            else:
                matched = (" " + clean + " ") in normalized
            if matched:
                score += 3 if task_type == "browse" and clean in {"search", "browse", "catalog", "library", "atlas"} else 1
        if score:
            ranked.append((score, -order, task_type, inputs, outputs, controls))
    if ranked:
        _, _, task_type, inputs, outputs, controls = max(ranked, key=lambda item: (item[0], item[1]))
        return {"task_type": task_type, "inputs": inputs, "outputs": outputs, "controls": controls}
    return {
        "task_type": "browse",
        "inputs": ["query", "filters"],
        "outputs": ["list", "preview", "metadata"],
        "controls": ["search", "filters", "preview", "metadata"],
    }


def _risk_profile(manifest: dict[str, Any], text: str) -> dict[str, Any]:
    declared = str(manifest.get("risk") or "").strip().upper()
    risk = {"LOW": "low", "MEDIUM": "moderate", "HIGH": "high", "CRITICAL": "critical"}.get(declared, "unknown")
    destructive = any(word in text for word in ("delete", "destroy", "irreversible", "retire", "wipe", "overwrite"))
    if risk == "unknown":
        reversibility = "unknown"
    elif destructive:
        reversibility = "irreversible"
    elif risk in {"high", "critical", "moderate"}:
        reversibility = "partly_reversible"
    else:
        reversibility = "fully_reversible"
    return {
        "risk_level": risk,
        "reversibility": reversibility,
        "privacy_sensitivity": "high" if any(word in text for word in ("secret", "credential", "identity", "private")) else ("medium" if risk in {"high", "critical"} else "low" if risk != "unknown" else "unknown"),
        "failure_modes": [
            "The module can be misunderstood when its declaration is incomplete.",
            "A declared capability does not by itself prove runtime behavior.",
        ],
        "human_confirmation_required": risk in {"high", "critical"} or destructive,
        "safe_preview_recommended": risk in {"moderate", "high", "critical"} or destructive,
    }


def _maturity_profile(manifest: dict[str, Any], indexed: dict[str, Any]) -> dict[str, Any]:
    status = str(manifest.get("status") or indexed.get("status") or "").upper()
    maturity = {"EXPERIMENTAL": "experimental", "SHELL": "experimental", "TEST": "tested", "WORKING": "working", "CANON": "stable"}.get(status, "unknown")
    selftest = indexed.get("selftest") if isinstance(indexed.get("selftest"), dict) else {}
    result = selftest.get("result") if isinstance(selftest.get("result"), dict) else {}
    proof = "tested" if result.get("verdict") == "PASS" else "declared" if status in {"TEST", "WORKING", "CANON"} else "unverified"
    return {
        "availability": "limited" if status == "SHELL" else "available",
        "maturity": maturity,
        "proof_status": proof,
        "known_limitations": [
            "This human guide is derived from the module manifest and does not replace live behavior testing.",
            "The interface recommendation is advisory TEST material until implemented and visually verified.",
        ],
    }


def _source_for(manifest: dict[str, Any], indexed: dict[str, Any], manifest_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    actions = _clean_list(manifest.get("actions"))
    accepts = _clean_list(manifest.get("accepts"))
    produces = _clean_list(manifest.get("produces"))
    task = _task_profile(manifest)
    summary = _sentence(str(manifest.get("summary") or ""))
    if not summary:
        summary = _sentence("Use " + str(manifest.get("name") or manifest.get("id")) + (" to " + actions[0] if actions else " through its declared local interface"))
    notes = _sentence(str(manifest.get("notes") or ""))
    why = summary + (" " + notes if notes and notes != summary else "")
    combined = " ".join([summary, notes, " ".join(actions), " ".join(_clean_list(manifest.get("uses")))]).lower()
    risk = _risk_profile(manifest, combined)
    audience = str(manifest.get("audience") or "human").lower()
    skill = "intermediate" if audience == "machine" else "beginner"
    collaboration = "supervised_automation" if audience == "machine" else "human_ai_shared" if "machine" in audience else "human_only"
    compute = "medium" if task["task_type"] in {"software_build", "media_editing", "image_editing", "data_analysis", "long_running_automation"} else "low"
    time = "medium" if task["task_type"] in {"software_build", "media_editing", "long_running_automation"} else "short"
    source = {
        "revision": str(manifest.get("version") or indexed.get("version") or "unknown"),
        "category": [str(manifest.get("category") or "uncategorized").lower()],
        "tags": _clean_list(manifest.get("tags")),
        "capability_id": "axm.module." + str(indexed["id"]) + ".human-use",
        "machine_name": str(indexed["id"]).replace("-", "_"),
        "human_name": str(manifest.get("name") or indexed.get("name") or indexed["id"]),
        "description": summary,
        "why_it_matters": why,
        "examples": [_sentence(actions[0]) if actions else "Open the module and review its declared purpose before acting."],
        "supported_task_types": [task["task_type"]],
        "typical_goals": [summary],
        "required_human_actions": [
            "Review the plain-language purpose and declared boundaries.",
            "Provide only the inputs the module declares.",
        ] + (["Confirm the consequence summary before execution."] if risk["human_confirmation_required"] else []),
        "required_machine_actions": actions or ["Present the declared local module interface."],
        "collaboration_modes": [collaboration],
        "inputs": {
            "input_types": task["inputs"],
            "required_inputs": accepts or ["No structured input type is declared."],
            "optional_inputs": [],
            "input_constraints": ["Do not infer permissions or accepted formats beyond the manifest."],
        },
        "outputs": {
            "output_types": task["outputs"],
            "expected_outputs": produces or ["No structured output type is declared."],
            "output_constraints": ["Treat outputs as candidates until the module reports tested completion."],
            "preview_available": "KNOWN" if "preview" in task["controls"] else "INFERRED",
        },
        "cost_profile": {
            "compute_cost": compute,
            "time_cost": time,
            "attention_cost": "medium" if risk["risk_level"] in {"moderate", "high", "critical"} else "low",
            "skill_cost": skill,
            "setup_cost": "low",
            "error_recovery_cost": "high" if risk["reversibility"] == "irreversible" else "medium" if risk["risk_level"] in {"moderate", "high", "critical"} else "low",
        },
        "risk_profile": risk,
        "maturity_profile": _maturity_profile(manifest, indexed),
        "learning_profile": {
            "minimum_skill_level": skill,
            "prerequisite_capability_ids": [],
            "recommended_learning_steps": [
                "Read what the module does and why it matters.",
                "Check accepted inputs, expected outputs, risk, and current status.",
                "Start with a non-destructive preview when one is recommended.",
            ],
            "beginner_safe_operations": ["Inspect the guide and module status without executing an action."],
            "advanced_operations": actions[1:4],
            "common_mistakes": ["Treating a manifest declaration or interface recommendation as runtime proof."],
        },
        "interaction_profile": {
            "interaction_complexity": "medium" if task["task_type"] in {"software_build", "media_editing", "long_running_automation", "data_analysis"} else "low",
            "interaction_frequency": "continuous" if task["task_type"] in {"monitoring", "game_controller_input"} else "iterative",
            "precision_requirement": "high" if task["task_type"] in {"drawing", "image_editing", "software_build"} else "medium",
            "feedback_requirement": "continuous" if task["task_type"] == "monitoring" else "preview" if "preview" in task["controls"] else "status",
            "preferred_input_methods": task["inputs"],
            "preferred_output_methods": task["outputs"],
            "accessibility_considerations": ["keyboard navigation", "screen-reader labels", "plain language before technical detail"],
        },
        "interface_requirements": {
            "required_interface_features": task["controls"],
            "optional_interface_features": ["help_text", "source_metadata", "status"],
            "unsafe_interface_patterns": ["automatic execution from an explanation", "hidden consequence or authority claims"],
            "beginner_layer_constraints": ["Show purpose, inputs, outputs, status, and risk before advanced controls."],
            "advanced_layer_requirements": ["Expose exact source provenance and technical limitations."],
        },
        "relationships": {
            "dependency_capability_ids": [],
            "related_capability_ids": _clean_list(indexed.get("contract", {}).get("provides")),
            "alternative_capability_ids": [],
            "commonly_combined_capability_ids": _clean_list(indexed.get("contract", {}).get("consumes")),
        },
        "source_reference": {
            "source_type": "manifest",
            "source_location": _portable(manifest_path),
            "source_hash": _sha_file(manifest_path),
            "last_verified_at": GENERATED_AT,
            "confidence": 1.0,
            "mapping_contract": "axm.platform-manifest-to-human-capability/v1",
        },
    }
    mapping = {
        "task_type": task["task_type"],
        "risk_rule": str(manifest.get("risk") or "UNDECLARED") + " -> " + risk["risk_level"],
        "reversibility_rule": risk["reversibility"],
        "derived_fields_are_advisory": True,
    }
    return source, mapping


def _context(source: dict[str, Any]) -> dict[str, Any]:
    risk = source["risk_profile"]["risk_level"]
    compute = source["cost_profile"]["compute_cost"]
    time = source["cost_profile"]["time_cost"]
    complexity = source["interaction_profile"]["interaction_complexity"]
    return {
        "user_skill_level": "beginner",
        "user_goal": source["typical_goals"][0],
        "task_type": source["supported_task_types"][0],
        "collaboration_mode": source["collaboration_modes"][0],
        "device_types": ["desktop", "phone"],
        "available_tools": [],
        "accessibility_needs": ["screen_reader", "reduced_cognitive_load"],
        "privacy_mode": "local_only",
        "offline_required": True,
        "resource_budget": {
            "compute": compute if compute in {"none", "very_low", "low", "medium", "high", "very_high", "unknown"} else "unknown",
            "time": time if time in {"instant", "short", "medium", "long", "variable", "unknown"} else "unknown",
            "attention": "medium" if risk in {"moderate", "high", "critical"} else "low",
            "complexity": complexity if complexity in {"none", "very_low", "low", "medium", "high", "very_high", "unknown"} else "unknown",
        },
    }


def _load_signal_engine():
    path = MODULE3 / "signal_metabolism" / "signal_engine.py"
    spec = importlib.util.spec_from_file_location("axm_platform_usability_signal_engine", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load Module 3 signal engine")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.TS = GENERATED_AT
    return module


def _filesystem_manifest_ids() -> tuple[list[str], list[dict[str, str]]]:
    ids: list[str] = []
    invalid: list[dict[str, str]] = []
    for folder in sorted((WORKSHOP / "tools").iterdir()):
        path = folder / "manifest.json"
        if not folder.is_dir() or folder.name.startswith("_") or not path.is_file():
            continue
        try:
            manifest = json.loads(path.read_text(encoding="utf-8-sig"))
        except (OSError, ValueError) as error:
            invalid.append({"folder": folder.name, "id": "", "reason": "invalid JSON: " + str(error)})
            continue
        module_id = str(manifest.get("id") or "")
        ids.append(module_id)
        if module_id != folder.name and str(manifest.get("folderAlias") or "") != folder.name:
            invalid.append({"folder": folder.name, "id": module_id, "reason": "id/folder mismatch"})
    return ids, invalid


def build_catalog(output: Path = DEFAULT_OUTPUT) -> dict[str, Any]:
    index = json.loads(TOOLS_INDEX.read_text(encoding="utf-8"))
    indexed_tools = sorted(index["tools"], key=lambda item: item["id"])
    indexed_ids = [str(item["id"]) for item in indexed_tools]
    filesystem_ids, invalid_filesystem = _filesystem_manifest_ids()
    world_state = load_world_state()

    items: list[dict[str, Any]] = []
    records: list[dict[str, Any]] = []
    signals: list[dict[str, Any]] = []
    manifest_drift: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []

    for indexed in indexed_tools:
        module_id = str(indexed["id"])
        manifest_path = WORKSHOP / indexed["manifest"]["path"]
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
            current_manifest_sha = _sha_file(manifest_path)
            indexed_manifest_sha = str(indexed["manifest"].get("sha256") or "")
            if current_manifest_sha != indexed_manifest_sha:
                manifest_drift.append({
                    "module_id": module_id,
                    "path": _portable(manifest_path),
                    "indexed_sha256": indexed_manifest_sha,
                    "current_sha256": current_manifest_sha,
                })
            if str(manifest.get("id")) != module_id:
                raise ValueError("current manifest id does not match the registered id")
            source, mapping = _source_for(manifest, indexed, manifest_path)
            card = build_card(source, manifest_path)
            card_errors = validate_card(card)
            if card_errors:
                raise ValueError("Module 1 card validation failed: " + "; ".join(card_errors[:8]))
            adapted, adaptation = adapt_capability_record(card)
            context = _context(source)
            recommendation = recommend_interface(adapted, context, generated_at=GENERATED_AT)
            assurance = build_recommendation_assurance(adapted, context, recommendation)
        except Exception as error:  # keep every registered failure visible in the receipt
            failures.append({"module_id": module_id, "error": str(error)[:1200]})
            continue

        selected = recommendation["recommended_interface"]
        recommendation_status = str(selected["recommendation_status"])
        assurance_status = str(assurance["overall_status"])
        world_context = world_context_for_module(manifest, str(selected["interface_pattern_id"] or ""), world_state)
        recommendation_gap = recommendation_status in {"insufficient_information", "no_safe_match"} or assurance_status in {"REVIEW", "BLOCKED"}
        world_change_gap = world_context["state"] == "REVIEW_REQUIRED"
        gap = recommendation_gap or world_change_gap
        recommendation_sha = digest_value(recommendation)
        card_sha = digest_value(card)
        candidate_id = "axm:need:human-usability:" + re.sub(r"[^a-z0-9-]+", "-", module_id.lower()).strip("-")
        if gap:
            if world_change_gap and not recommendation_gap:
                statement = f"The registered module {module_id} has relevant external interface source changes that need human applicability review."
            elif world_change_gap:
                statement = f"The registered module {module_id} needs recommendation review and external interface-source applicability review."
            else:
                statement = f"The registered module {module_id} still needs human review before its generated interface guidance can be treated as implemented."
            derivative = {
                "kind": "NEED_CANDIDATE",
                "target_id": candidate_id,
                "reason": f"Recommendation={recommendation_status}; assurance={assurance_status}; world_fit={world_context['state']}. Retain for applicability, implementation, and visual review without automatic promotion.",
            }
            gap_state = "REVIEW_REQUIRED"
        else:
            statement = f"The registered module {module_id} has a deterministic human explanation and an assured advisory interface pattern."
            derivative = {
                "kind": "NO_ACTION",
                "target_id": None,
                "reason": "Retain the advisory result; implementation and visual approval remain separate.",
            }
            gap_state = "GUIDANCE_READY"
        signals.append({
            "occurrence_id": "platform-usability-" + module_id,
            "captured_at": GENERATED_AT,
            "source_type": "TEST_RESULT",
            "source_location": "shared/capability-intelligence/generated/platform-usability/catalog.json",
            "source_digest": recommendation_sha,
            "signal_type": "GAP" if gap else "RESULT",
            "statement": statement,
            "truth_state": "TESTED",
            "linked_scope": ["axm:module:" + module_id, "axm:module:human-interface-intelligence"],
            "assessment": {
                "state": "CORROBORATED",
                "reason": "The exact recommendation and assurance statuses are retained in the coverage receipt.",
                "evidence_refs": ["artifact:manifest:sha256:" + current_manifest_sha, "artifact:recommendation:" + recommendation_sha, "artifact:interface-world-context:" + world_context["world_context_sha256"]],
            },
            "derivative_candidates": [derivative],
        })
        item = {
            "module_id": module_id,
            "module_name": str(manifest.get("name") or indexed.get("name") or module_id),
            "route": "/" + str(indexed["entry"]["path"]).replace("\\", "/"),
            "status": str(manifest.get("status") or indexed.get("status") or "UNKNOWN"),
            "risk": source["risk_profile"]["risk_level"],
            "source": {
                "manifest": _portable(manifest_path),
                "manifest_sha256": current_manifest_sha,
                "indexed_manifest_sha256": indexed_manifest_sha,
                "mapping": mapping,
            },
            "module1": {
                "capability_id": card["capability_id"],
                "capability_record_sha256": card_sha,
                "human_name": card["identity"]["human_name"],
                "plain_explanation": card["purpose"]["plain_explanation"],
                "why_it_matters": card["purpose"]["why_it_matters"],
                "inputs": card["input_profile"]["required_inputs"],
                "outputs": card["output_profile"]["expected_outputs"],
                "known_limitations": card["maturity_profile"]["known_limitations"],
                "unknown_fields": card["knowledge"]["unknowns"],
            },
            "module2": {
                "recommendation_id": recommendation["recommendation_id"],
                "recommendation_sha256": recommendation_sha,
                "recommendation_status": recommendation_status,
                "interface_pattern_id": selected["interface_pattern_id"],
                "interface_name": selected["interface_name"],
                "confidence": selected["confidence"],
                "required_controls": selected["required_controls"],
                "why": selected["why_this_interface"],
                "assurance_status": assurance_status,
                "assurance_counts": assurance["check_counts"],
                "world_fit": world_context,
            },
            "module3": {
                "gap_state": gap_state,
                "candidate_id": candidate_id if gap else None,
                "world_change_state": world_context["state"],
                "world_change_source_ids": world_context["change_source_ids"],
                "world_context_sha256": world_context["world_context_sha256"],
                "authority_granted": False,
            },
            "truth": {
                "advisory_test_material": True,
                "interface_implementation_proven": False,
                "runtime_behavior_proven": False,
                "automatic_execution": False,
                "automatic_canon": False,
            },
        }
        items.append(item)
        records.append({
            "module_id": module_id,
            "module1_card_sha256": card_sha,
            "module1_valid": True,
            "module1_to_module2_digest_match": adaptation["source"]["record_sha256"] == card_sha,
            "module2_adapted_sha256": adaptation["target"]["record_sha256"],
            "module2_recommendation_sha256": recommendation_sha,
            "module2_status": recommendation_status,
            "module2_assurance": assurance_status,
            "module3_gap_state": gap_state,
            "world_fit_state": world_context["state"],
            "world_context_sha256": world_context["world_context_sha256"],
        })

    signal_engine = _load_signal_engine()
    signal_report = signal_engine.build(signals)
    signal_engine.validate(signal_report)
    authority_closed = all(not any(signal["authority"].values()) for signal in signal_report["signals"])

    catalog: dict[str, Any] = {
        "schema": CATALOG_SCHEMA,
        "generated_at": GENERATED_AT,
        "source": {
            "tools_index": _portable(TOOLS_INDEX),
            "tools_index_sha256": _sha_file(TOOLS_INDEX),
            "tools_index_source_digest": index["sourceDigest"],
            "registered_modules": len(indexed_ids),
            "declared_capabilities": index["summary"]["capabilities"],
            "interface_world_source_registry": "shared/capability-intelligence/world-interface/sources.json",
            "interface_world_signal_registry": "shared/capability-intelligence/world-interface/signals.json",
            "interface_world_latest_sha256": world_state["latest"].get("latest_sha256"),
        },
        "coverage": {
            "registered_modules": len(indexed_ids),
            "guided_modules": len(items),
            "failed_modules": len(failures),
            "all_registered_modules_guided": len(items) == len(indexed_ids) and not failures,
        },
        "items": items,
        "truth": {
            "status": "TEST",
            "shared_human_guidance_layer": True,
            "module_owned_interfaces_rewritten": False,
            "individual_interface_visual_verification_claimed": False,
            "external_guidance_is_advisory": True,
            "external_source_change_auto_applied": False,
            "automatic_execution": False,
            "automatic_canon": False,
        },
    }
    catalog["catalog_sha256"] = digest_value({key: value for key, value in catalog.items() if key != "catalog_sha256"})

    status_counts = Counter(item["status"] for item in items)
    risk_counts = Counter(item["risk"] for item in items)
    pattern_counts = Counter(item["module2"]["interface_pattern_id"] or "NONE" for item in items)
    recommendation_counts = Counter(item["module2"]["recommendation_status"] for item in items)
    assurance_counts = Counter(item["module2"]["assurance_status"] for item in items)
    gap_counts = Counter(item["module3"]["gap_state"] for item in items)
    world_fit_counts = Counter(item["module2"]["world_fit"]["state"] for item in items)
    unindexed_ids = sorted(set(filesystem_ids) - set(indexed_ids))
    missing_filesystem_ids = sorted(set(indexed_ids) - set(filesystem_ids))
    receipt: dict[str, Any] = {
        "schema": RECEIPT_SCHEMA,
        "generated_at": GENERATED_AT,
        "verdict": "PASS" if len(items) == len(indexed_ids) and not failures and authority_closed else "FAIL",
        "module_chain": {
            "module1": {"version": "0.11.0", "validated_cards": len(records)},
            "module1_to_module2": {"digest_matches": sum(1 for row in records if row["module1_to_module2_digest_match"]), "native_paired_gate": "BLOCKED"},
            "module2": {"version": "0.6.0", "recommendations": len(records), "recommendation_statuses": dict(sorted(recommendation_counts.items())), "assurance_statuses": dict(sorted(assurance_counts.items())), "patterns": dict(sorted(pattern_counts.items()))},
            "module3": {"version": "0.7.0", "signals": signal_report["unique_signals"], "occurrences": signal_report["occurrences"], "gap_states": dict(sorted(gap_counts.items())), "authority_remains_closed": authority_closed, "signal_chain_head": signal_report["signal_chain_head"], "report_sha256": signal_report["report_hash"]},
            "interface_world": {"sources": world_state["latest"].get("summary", {}).get("sources", 0), "source_states": world_state["latest"].get("summary", {}).get("states", {}), "module_fit_states": dict(sorted(world_fit_counts.items())), "source_event_chain_head": world_state["latest"].get("summary", {}).get("event_chain_head")},
        },
        "coverage": {
            "registered_id_count": len(indexed_ids),
            "completed_id_count": len(items),
            "declared_capability_count": index["summary"]["capabilities"],
            "all_registered_ids_completed": [item["module_id"] for item in items] == indexed_ids,
            "status_counts": dict(sorted(status_counts.items())),
            "risk_counts": dict(sorted(risk_counts.items())),
        },
        "moving_workspace": {
            "manifest_byte_drift_from_index": manifest_drift,
            "unindexed_manifest_ids": unindexed_ids,
            "registered_ids_without_current_manifest": missing_filesystem_ids,
            "invalid_filesystem_manifests": invalid_filesystem,
        },
        "failures": failures,
        "records": records,
        "artifacts": {
            "catalog": "catalog.json",
            "catalog_sha256": catalog["catalog_sha256"],
            "signal_inputs": "module3/signal_inputs.json",
            "signal_report": "module3/signal_metabolism_report.json",
            "interface_world_impact_map": "world-interface-impact.json",
        },
        "truth": {
            "platform_guidance_is_implemented": True,
            "all_module_owned_interfaces_are_individually_rewritten": False,
            "all_module_owned_interfaces_are_individually_visually_verified": False,
            "external_source_changes_are_automatically_applied": False,
            "recommendations_grant_execution_authority": False,
            "recommendations_grant_canon": False,
        },
    }
    receipt["receipt_sha256"] = digest_value({key: value for key, value in receipt.items() if key != "receipt_sha256"})

    _write_json(output / "catalog.json", catalog)
    _write_json(output / "module3" / "signal_inputs.json", {"schema": "axm.gei.platform-signal-input/v1", "signals": signals})
    _write_json(output / "module3" / "signal_metabolism_report.json", signal_report)
    _write_json(output / "world-interface-impact.json", build_impact_map(items, GENERATED_AT, world_state["latest"]))
    _write_json(output / "coverage-receipt.json", receipt)
    return receipt


def verify_existing(output: Path = DEFAULT_OUTPUT) -> dict[str, Any]:
    catalog = json.loads((output / "catalog.json").read_text(encoding="utf-8"))
    receipt = json.loads((output / "coverage-receipt.json").read_text(encoding="utf-8"))
    signal_report = json.loads((output / "module3" / "signal_metabolism_report.json").read_text(encoding="utf-8"))
    impact_map = json.loads((output / "world-interface-impact.json").read_text(encoding="utf-8"))
    signal_engine = _load_signal_engine()
    signal_engine.validate(signal_report)
    declared_catalog = catalog["catalog_sha256"]
    actual_catalog = digest_value({key: value for key, value in catalog.items() if key != "catalog_sha256"})
    declared_receipt = receipt["receipt_sha256"]
    actual_receipt = digest_value({key: value for key, value in receipt.items() if key != "receipt_sha256"})
    ids = [item["module_id"] for item in catalog["items"]]
    checks = {
        "schema": catalog.get("schema") == CATALOG_SCHEMA and receipt.get("schema") == RECEIPT_SCHEMA,
        "catalog_digest": declared_catalog == actual_catalog,
        "receipt_digest": declared_receipt == actual_receipt,
        "receipt_verdict": receipt.get("verdict") == "PASS",
        "registered_coverage": catalog["coverage"]["all_registered_modules_guided"] and len(ids) == catalog["source"]["registered_modules"],
        "unique_sorted_ids": ids == sorted(set(ids)),
        "module1_valid": all(row["module1_valid"] for row in receipt["records"]),
        "bridge_digest_match": all(row["module1_to_module2_digest_match"] for row in receipt["records"]),
        "module2_present": all(item["module2"]["recommendation_id"] for item in catalog["items"]),
        "world_fit_present": all(item["module2"].get("world_fit", {}).get("world_context_sha256") for item in catalog["items"]),
        "world_impact_complete": impact_map.get("summary", {}).get("modules") == len(ids),
        "module3_signal_count": signal_report["unique_signals"] == len(ids),
        "authority_closed": receipt["module_chain"]["module3"]["authority_remains_closed"],
        "no_execution_or_canon": all(not item["truth"]["automatic_execution"] and not item["truth"]["automatic_canon"] for item in catalog["items"]),
    }
    return {"status": "PASS" if all(checks.values()) else "FAIL", "checks": checks, "catalog_sha256": declared_catalog, "receipt_sha256": declared_receipt, "modules": len(ids)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Build or verify Workshop-wide human-usability guidance")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--verify-existing", action="store_true")
    args = parser.parse_args()
    if args.verify_existing:
        result = verify_existing(args.output)
    else:
        receipt = build_catalog(args.output)
        result = {"status": receipt["verdict"], "modules": receipt["coverage"]["completed_id_count"], "capabilities": receipt["coverage"]["declared_capability_count"], "receipt_sha256": receipt["receipt_sha256"], "output": str(args.output)}
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
