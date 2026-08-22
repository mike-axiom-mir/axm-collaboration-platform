
from __future__ import annotations
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    error_codes: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {'ok': self.ok, 'error_codes': list(self.error_codes)}


def _add(errors: list[str], condition: bool, code: str) -> None:
    if condition and code not in errors:
        errors.append(code)


def validate_fixture(fixture: dict[str, Any], registry_entry: dict[str, Any]) -> ValidationResult:
    errors: list[str] = []
    required_sections = registry_entry['required_fixture_sections']
    for section in required_sections:
        _add(errors, section not in fixture, f'MISSING_SECTION:{section}')
    if errors:
        return ValidationResult(False, tuple(errors))

    _add(errors, fixture.get('module_id') != registry_entry.get('module_id'), 'MODULE_ID_MISMATCH')
    _add(errors, fixture.get('proof_slice_id') != registry_entry.get('proof_slice_id'), 'PROOF_SLICE_ID_MISMATCH')
    _add(errors, fixture.get('registry_entry_digest') != registry_entry.get('registry_entry_digest'), 'REGISTRY_DIGEST_MISMATCH')
    _add(errors, fixture.get('family') != registry_entry.get('family'), 'FAMILY_MISMATCH')

    family = fixture['family']
    actor = fixture['actor']
    authority = fixture['authority']
    privacy = fixture['privacy']
    task = fixture['task']
    routing = fixture['routing']
    handoff = fixture['handoff']
    pattern = fixture['pattern']
    verification = fixture['verification']
    artifact = fixture['artifact']
    resources = fixture['resources']
    control = fixture['control']
    human = fixture['human']
    evidence = fixture['evidence']

    if family == 'identity_authority_privacy':
        _add(errors, not actor.get('identity_id') or actor.get('identity_id') == actor.get('route_id'), 'IDENTITY_INFERRED_FROM_ROUTE')
        parent_actions = set(authority.get('allowed_actions', []))
        child_actions = set(authority.get('child_actions', []))
        _add(errors, authority.get('scope_broadened') or not child_actions.issubset(parent_actions), 'AUTHORITY_SCOPE_BROADENED')
        _add(errors, privacy.get('context_contains_private') and not privacy.get('transfer_authorized'), 'PRIVATE_CONTEXT_UNAUTHORIZED')
    elif family == 'task_contracts':
        _add(errors, not str(task.get('goal', '')).strip(), 'TASK_GOAL_MISSING')
        _add(errors, (task.get('state') in {'ACCEPTED', 'ACTIVE', 'RETURNED', 'UNDER_REVIEW'} or bool(task.get('result_accepted'))) and not task.get('acceptance_receipt'), 'ACCEPTANCE_RECEIPT_MISSING')
        _add(errors, bool(task.get('result_accepted')) and not task.get('review_receipt'), 'RESULT_ACCEPTED_BEFORE_REVIEW')
    elif family == 'routing_allocation':
        _add(errors, routing.get('selected') and not routing.get('eligible'), 'INELIGIBLE_SEAT_SELECTED')
        _add(errors, routing.get('selected_by_self_confidence_only') or not routing.get('evidence_history_refs'), 'SELF_CONFIDENCE_USED_AS_AUTHORITY')
    elif family == 'handoff_continuity':
        _add(errors, handoff.get('receiver_state') in {'ACTIVE', 'RETURNED'} and not handoff.get('receiver_acceptance_receipt'), 'RECEIVER_ACTIVE_BEFORE_ACCEPTANCE')
        _add(errors, int(handoff.get('depth', 0)) > int(handoff.get('max_depth', 0)), 'HANDOFF_DEPTH_EXCEEDED')
        _add(errors, handoff.get('private_context_included') and not privacy.get('transfer_authorized'), 'PRIVATE_CONTEXT_UNAUTHORIZED')
    elif family == 'collaboration_patterns':
        _add(errors, not pattern.get('human_visible'), 'HIDDEN_COLLABORATION')
        _add(errors, not pattern.get('merge_gate_required'), 'MERGE_GATE_BYPASSED')
        _add(errors, bool(pattern.get('hidden_coauthor')), 'HIDDEN_COAUTHORSHIP')
    elif family == 'dissent_verification':
        _add(errors, verification.get('producer_id') == verification.get('verifier_id'), 'BUILDER_VERIFIER_COLLAPSE')
        lineages = verification.get('lineage_ids', [])
        _add(errors, len(lineages) < 2 or len(set(lineages)) < 2 or verification.get('copied_context'), 'CORRELATED_LINEAGE')
        _add(errors, not verification.get('dissent_preserved'), 'DISSENT_DROPPED')
    elif family == 'artifacts_merge':
        _add(errors, artifact.get('actual_revision') != artifact.get('expected_revision'), 'STALE_BASE_REVISION')
        _add(errors, not artifact.get('write_lease_valid'), 'WRITE_LEASE_INVALID')
        _add(errors, not artifact.get('rollback_ref'), 'ROLLBACK_MISSING')
    elif family == 'resources_scheduling':
        _add(errors, sum(resources.get('child_reservations', [])) > resources.get('parent_limit', 0), 'PARENT_BUDGET_EXCEEDED')
        _add(errors, resources.get('concurrency', 0) > resources.get('concurrency_limit', 0), 'CONCURRENCY_LIMIT_EXCEEDED')
        _add(errors, resources.get('expired') and resources.get('active'), 'EXPIRED_WORK_ACTIVE')
    elif family == 'guardrails_recovery':
        _add(errors, control.get('tripwire') and not control.get('stopped'), 'TRIPWIRE_NOT_STOPPED')
        _add(errors, control.get('tripwire') and not evidence.get('incident_evidence_refs'), 'INCIDENT_EVIDENCE_MISSING')
        _add(errors, control.get('tripwire') and not control.get('stopped') and not control.get('resume_authorization'), 'RESUME_AUTHORIZATION_MISSING')
    elif family == 'human_governance':
        _add(errors, not human.get('explicit') or not human.get('decision_id') or not human.get('decision'), 'HUMAN_DECISION_NOT_EXPLICIT')
        _add(errors, bool(human.get('orchestrator_self_approval')), 'ORCHESTRATOR_SELF_APPROVAL')
        _add(errors, bool(human.get('canon')), 'CANON_WITHOUT_HUMAN_GATE')
    else:
        _add(errors, True, 'UNKNOWN_FAMILY')

    return ValidationResult(not errors, tuple(errors))
