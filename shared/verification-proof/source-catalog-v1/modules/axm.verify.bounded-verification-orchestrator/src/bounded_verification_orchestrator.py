"""Detached AXM Bounded Verification Orchestrator v0.1.0.

Coordinates supplied verification metadata without executing verifiers, deciding
release, granting approval, publishing evidence, or promoting CANON.
"""
from __future__ import annotations
from collections import defaultdict
from hashlib import sha256
from typing import Any, Dict, Mapping, Sequence
import json

VERDICT_STATES = {"PASS", "FAIL", "UNKNOWN", "NOT_RUN", "CONFLICTED", "STALE", "HUMAN_REVIEW"}


class VerificationOrchestratorError(ValueError):
    """Raised when a coordination packet violates the explicit local contract."""


def _text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise VerificationOrchestratorError(f"{field} required")
    return " ".join(value.strip().splitlines())


def _string_list(value: Any, field: str) -> list[str]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)):
        raise VerificationOrchestratorError(f"{field} must be a sequence")
    result = [_text(item, field) for item in value]
    if len(result) != len(set(result)):
        raise VerificationOrchestratorError(f"{field} contains duplicates")
    return result


def _canonical_digest(payload: Mapping[str, Any]) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return sha256(encoded).hexdigest()


class BoundedVerificationOrchestrator:
    """Build a bounded coordination packet from already-supplied local facts."""

    def coordinate(
        self,
        claims: Sequence[Mapping[str, Any]],
        profile: Mapping[str, Any],
        available_organs: Sequence[str],
        receipts: Sequence[Mapping[str, Any]] | None = None,
        conflicts: Sequence[Mapping[str, Any]] | None = None,
        human_reviews: Sequence[Mapping[str, Any]] | None = None,
        release_context: Mapping[str, Any] | None = None,
    ) -> Dict[str, Any]:
        if not isinstance(claims, Sequence) or isinstance(claims, (str, bytes)) or not claims:
            raise VerificationOrchestratorError("claims must be a non-empty sequence")
        if not isinstance(profile, Mapping):
            raise VerificationOrchestratorError("profile must be a mapping")
        profile_id = _text(profile.get("profile_id"), "profile_id")
        requirements_raw = profile.get("requirements")
        if not isinstance(requirements_raw, Sequence) or isinstance(requirements_raw, (str, bytes)):
            raise VerificationOrchestratorError("requirements must be a sequence")
        available = set(_string_list(available_organs, "available_organs"))

        claim_map: dict[str, dict[str, str]] = {}
        for raw in claims:
            if not isinstance(raw, Mapping):
                raise VerificationOrchestratorError("claim must be a mapping")
            claim = {
                "claim_id": _text(raw.get("claim_id"), "claim_id"),
                "claim_type": _text(raw.get("claim_type"), "claim_type"),
                "subject_ref": _text(raw.get("subject_ref"), "subject_ref"),
                "scope_ref": _text(raw.get("scope_ref"), "scope_ref"),
            }
            if claim["claim_id"] in claim_map:
                raise VerificationOrchestratorError("duplicate claim_id")
            claim_map[claim["claim_id"]] = claim

        requirements: list[dict[str, Any]] = []
        requirement_ids: set[str] = set()
        for raw in requirements_raw:
            if not isinstance(raw, Mapping):
                raise VerificationOrchestratorError("requirement must be a mapping")
            requirement = {
                "requirement_id": _text(raw.get("requirement_id"), "requirement_id"),
                "claim_type": _text(raw.get("claim_type"), "claim_type"),
                "proof_surface": _text(raw.get("proof_surface"), "proof_surface"),
                "verifier_id": _text(raw.get("verifier_id"), "verifier_id"),
                "independent_verifier_required": raw.get("independent_verifier_required", False),
                "human_review_required": raw.get("human_review_required", False),
            }
            if requirement["requirement_id"] in requirement_ids:
                raise VerificationOrchestratorError("duplicate requirement_id")
            if not isinstance(requirement["independent_verifier_required"], bool) or not isinstance(requirement["human_review_required"], bool):
                raise VerificationOrchestratorError("requirement flags must be boolean")
            requirement_ids.add(requirement["requirement_id"])
            requirements.append(requirement)

        receipt_rows = self._normalize_receipts(receipts or [], claim_map)
        conflict_rows = self._normalize_conflicts(conflicts or [], claim_map)
        review_rows = self._normalize_reviews(human_reviews or [], claim_map)
        by_claim_receipts: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for receipt in receipt_rows:
            by_claim_receipts[receipt["claim_id"]].append(receipt)
        by_claim_conflicts: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for conflict in conflict_rows:
            by_claim_conflicts[conflict["claim_id"]].append(conflict)
        by_claim_reviews: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for review in review_rows:
            by_claim_reviews[review["claim_id"]].append(review)

        claim_results = []
        selected_organs: set[str] = set()
        for claim_id in sorted(claim_map):
            claim = claim_map[claim_id]
            applicable = sorted(
                (item for item in requirements if item["claim_type"] == claim["claim_type"]),
                key=lambda item: item["requirement_id"],
            )
            missing_organs = sorted({item["verifier_id"] for item in applicable if item["verifier_id"] not in available})
            selected_organs.update(item["verifier_id"] for item in applicable if item["verifier_id"] in available)
            unmet: list[str] = []
            states_seen: set[str] = set()
            required_human_review = any(item["human_review_required"] for item in applicable)

            for requirement in applicable:
                matching = [
                    receipt for receipt in by_claim_receipts[claim_id]
                    if receipt["proof_surface"] == requirement["proof_surface"]
                    and receipt["verifier_id"] == requirement["verifier_id"]
                ]
                if requirement["independent_verifier_required"]:
                    matching = [receipt for receipt in matching if receipt["independent"]]
                if not matching:
                    unmet.append(requirement["requirement_id"])
                    continue
                states_seen.update(receipt["verdict_state"] for receipt in matching)
                if not any(receipt["verdict_state"] == "PASS" and receipt["fresh"] for receipt in matching):
                    unmet.append(requirement["requirement_id"])

            unresolved_conflicts = sorted(
                conflict["conflict_id"] for conflict in by_claim_conflicts[claim_id] if not conflict["resolved"]
            )
            review_satisfied = any(
                review["verdict_state"] == "PASS" and review["within_authority"]
                for review in by_claim_reviews[claim_id]
            )
            readiness = self._readiness(
                applicable=applicable,
                missing_organs=missing_organs,
                unmet=unmet,
                states_seen=states_seen,
                unresolved_conflicts=unresolved_conflicts,
                human_review_required=required_human_review,
                human_review_satisfied=review_satisfied,
            )
            claim_results.append({
                **claim,
                "required_routes": applicable,
                "missing_organs": missing_organs,
                "unmet_requirement_ids": sorted(unmet),
                "unresolved_conflict_ids": unresolved_conflicts,
                "human_review_required": required_human_review,
                "human_review_satisfied": review_satisfied,
                "coordination_readiness": readiness,
            })

        release = self._release_context(release_context or {})
        all_claims_ready = bool(claim_results) and all(row["coordination_readiness"] == "PASS" for row in claim_results)
        release_context_complete = all(release.values())
        external_gate_state = "READY_FOR_EXTERNAL_GATE" if all_claims_ready and release_context_complete else "BLOCKED"
        packet = {
            "schema_version": "axm.verify.bounded-verification-orchestrator/0.1",
            "profile_id": profile_id,
            "claim_results": claim_results,
            "selected_available_organs": sorted(selected_organs),
            "unselected_available_organs": sorted(available - selected_organs),
            "release_context": release,
            "external_gate_state": external_gate_state,
            "tests_executed": False,
            "receipts_created": False,
            "approved": False,
            "published": False,
            "canon": False,
            "authority": "NONE",
        }
        packet["coordination_digest"] = _canonical_digest(packet)
        return packet

    def _normalize_receipts(self, rows: Sequence[Mapping[str, Any]], claims: Mapping[str, Any]) -> list[dict[str, Any]]:
        if not isinstance(rows, Sequence) or isinstance(rows, (str, bytes)):
            raise VerificationOrchestratorError("receipts must be a sequence")
        normalized = []
        receipt_ids: set[str] = set()
        for raw in rows:
            if not isinstance(raw, Mapping):
                raise VerificationOrchestratorError("receipt must be a mapping")
            receipt = {
                "receipt_id": _text(raw.get("receipt_id"), "receipt_id"),
                "claim_id": _text(raw.get("claim_id"), "receipt claim_id"),
                "proof_surface": _text(raw.get("proof_surface"), "proof_surface"),
                "verifier_id": _text(raw.get("verifier_id"), "verifier_id"),
                "verdict_state": raw.get("verdict_state"),
                "evidence_ref": _text(raw.get("evidence_ref"), "evidence_ref"),
                "fresh": raw.get("fresh"),
                "independent": raw.get("independent"),
            }
            if receipt["receipt_id"] in receipt_ids:
                raise VerificationOrchestratorError("duplicate receipt_id")
            if receipt["claim_id"] not in claims:
                raise VerificationOrchestratorError("receipt references unknown claim")
            if receipt["verdict_state"] not in VERDICT_STATES:
                raise VerificationOrchestratorError("invalid receipt verdict_state")
            if not isinstance(receipt["fresh"], bool) or not isinstance(receipt["independent"], bool):
                raise VerificationOrchestratorError("receipt fresh and independent must be boolean")
            receipt_ids.add(receipt["receipt_id"])
            normalized.append(receipt)
        return normalized

    def _normalize_conflicts(self, rows: Sequence[Mapping[str, Any]], claims: Mapping[str, Any]) -> list[dict[str, Any]]:
        if not isinstance(rows, Sequence) or isinstance(rows, (str, bytes)):
            raise VerificationOrchestratorError("conflicts must be a sequence")
        result = []
        for raw in rows:
            if not isinstance(raw, Mapping):
                raise VerificationOrchestratorError("conflict must be a mapping")
            claim_id = _text(raw.get("claim_id"), "conflict claim_id")
            if claim_id not in claims:
                raise VerificationOrchestratorError("conflict references unknown claim")
            resolved = raw.get("resolved")
            if not isinstance(resolved, bool):
                raise VerificationOrchestratorError("conflict resolved must be boolean")
            result.append({"conflict_id": _text(raw.get("conflict_id"), "conflict_id"), "claim_id": claim_id, "resolved": resolved})
        return result

    def _normalize_reviews(self, rows: Sequence[Mapping[str, Any]], claims: Mapping[str, Any]) -> list[dict[str, Any]]:
        if not isinstance(rows, Sequence) or isinstance(rows, (str, bytes)):
            raise VerificationOrchestratorError("human_reviews must be a sequence")
        result = []
        for raw in rows:
            if not isinstance(raw, Mapping):
                raise VerificationOrchestratorError("human review must be a mapping")
            claim_id = _text(raw.get("claim_id"), "review claim_id")
            if claim_id not in claims:
                raise VerificationOrchestratorError("review references unknown claim")
            state = raw.get("verdict_state")
            if state not in VERDICT_STATES:
                raise VerificationOrchestratorError("invalid review verdict_state")
            within = raw.get("within_authority")
            if not isinstance(within, bool):
                raise VerificationOrchestratorError("within_authority must be boolean")
            result.append({
                "review_id": _text(raw.get("review_id"), "review_id"),
                "claim_id": claim_id,
                "verdict_state": state,
                "review_ref": _text(raw.get("review_ref"), "review_ref"),
                "within_authority": within,
            })
        return result

    @staticmethod
    def _readiness(
        *,
        applicable: Sequence[Mapping[str, Any]],
        missing_organs: Sequence[str],
        unmet: Sequence[str],
        states_seen: set[str],
        unresolved_conflicts: Sequence[str],
        human_review_required: bool,
        human_review_satisfied: bool,
    ) -> str:
        if unresolved_conflicts or "CONFLICTED" in states_seen or ({"PASS", "FAIL"} <= states_seen):
            return "CONFLICTED"
        if "FAIL" in states_seen:
            return "FAIL"
        if "STALE" in states_seen:
            return "STALE"
        if human_review_required and not human_review_satisfied:
            return "HUMAN_REVIEW"
        if not applicable or missing_organs or unmet or states_seen & {"UNKNOWN", "NOT_RUN", "HUMAN_REVIEW"}:
            return "UNKNOWN"
        return "PASS"

    @staticmethod
    def _release_context(raw: Mapping[str, Any]) -> dict[str, str]:
        if not isinstance(raw, Mapping):
            raise VerificationOrchestratorError("release_context must be a mapping")
        result = {}
        for field in ("artifact_identity", "rollback_ref", "proof_export_ref"):
            value = raw.get(field, "")
            if value is None:
                value = ""
            if not isinstance(value, str):
                raise VerificationOrchestratorError(f"{field} must be text")
            result[field] = " ".join(value.strip().splitlines())
        return result
