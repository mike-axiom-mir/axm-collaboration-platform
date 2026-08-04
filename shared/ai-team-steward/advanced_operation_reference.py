from __future__ import annotations

from dataclasses import asdict, is_dataclass
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
HARNESS = ROOT / 'intakes' / 'ai-team-collaboration-runs-01-101-v1' / 'proof-harness-v7'
sys.path.insert(0, str(HARNESS))

from axm_team_harness.adapter import check_conformance
from axm_team_harness.appeal_v4 import Appeal, evaluate_appeal
from axm_team_harness.attention_v4 import ReviewItem, schedule_reviews
from axm_team_harness.attestation_v4 import CapabilityAttestation, validate_attestation
from axm_team_harness.authority_epoch_v6 import AuthorityPacket, rotate_epoch, validate_packet
from axm_team_harness.causal_reconciliation_v6 import VersionedPacket, reconcile as causal_reconcile
from axm_team_harness.claims_v4 import Claim, evaluate_claims, may_reopen
from axm_team_harness.coalition_v5 import CoalitionCharter, CoalitionMember, dissolve, validate_coalition
from axm_team_harness.compatibility_v4 import validate_adapter
from axm_team_harness.contestability_v5 import Challenge, evaluate_challenge
from axm_team_harness.delegation_closure_v6 import ChildDelegation, evaluate_parent_close
from axm_team_harness.final_gate_v7 import evaluate_final_gate
from axm_team_harness.freshness_v5 import EvidenceNode, evaluate_freshness
from axm_team_harness.human_decision import DecisionReceipt, validate_decision
from axm_team_harness.human_handoff_v7 import validate_handoff_kit
from axm_team_harness.independence import Lineage, evaluate_consensus
from axm_team_harness.information_barrier_v5 import authorize_exchange
from axm_team_harness.intake import IntakeEvidence, evaluate_intake
from axm_team_harness.intake_rehearsal_v5 import validate_intake_rehearsal
from axm_team_harness.migration import adapt_payload
from axm_team_harness.observability import evaluate_service, validate_event
from axm_team_harness.proof_frontier_v5 import evaluate_novelty, minimal_proof_frontier, select_change_tests
from axm_team_harness.quorum_v4 import Vote, evaluate_quorum
from axm_team_harness.readiness_gate_v6 import evaluate_readiness
from axm_team_harness.release_v4 import validate_release_bundle
from axm_team_harness.revocation_v5 import LeaseNode, authorize, cascade_revoke, resume_with_new_lease
from axm_team_harness.role_reassignment_v5 import Assignment, validate_reassignment
from axm_team_harness.topology import SeatRouteLock, failover, reconcile_partition


def plain(value):
    if is_dataclass(value):
        return plain(asdict(value))
    if isinstance(value, dict):
        return {str(key): plain(item) for key, item in value.items()}
    if isinstance(value, (set, frozenset)):
        return sorted(plain(item) for item in value)
    if isinstance(value, (list, tuple)):
        return [plain(item) for item in value]
    return value


def adapter_conformance(data):
    return check_conformance(data['source'], data['output'], required_fields=set(data['required_fields']))


def appeal_evaluate(data):
    return evaluate_appeal(Appeal(**data['appeal']), expected_scope=data['expected_scope'], human_reopen=bool(data['human_reopen']))


def attention_schedule(data):
    return schedule_reviews([ReviewItem(**item) for item in data['items']], budget=int(data['budget']), fatigue_used=int(data['fatigue_used']), fatigue_threshold=int(data['fatigue_threshold']))


def attestation_validate(data):
    value = dict(data['attestation']); value['scope'] = frozenset(value['scope'])
    return validate_attestation(CapabilityAttestation(**value), now_tick=int(data['now_tick']), trusted_issuer_classes=set(data['trusted_issuer_classes']), allowed_scope=set(data['allowed_scope']))


def claims_evaluate(data):
    claims = []
    for item in data['claims']:
        value = dict(item); value['source_digests'] = tuple(value['source_digests']); claims.append(Claim(**value))
    return evaluate_claims(claims, now_tick=int(data['now_tick']))


def claims_reopen(data):
    return may_reopen(prior_evidence_digest=data['prior_evidence_digest'], new_evidence_digest=data['new_evidence_digest'], human_reopen=bool(data['human_reopen']))


def compatibility_validate_adapter(data):
    return validate_adapter(source_actions=set(data['source_actions']), target_actions=set(data['target_actions']), source_evidence=set(data['source_evidence']), target_evidence=set(data['target_evidence']))


def human_decision_validate(data):
    receipt = DecisionReceipt(**data['receipt']) if data.get('receipt') is not None else None
    return validate_decision(receipt, required_scope=data['required_scope'], now_tick=int(data['now_tick']))


def independence_evaluate(data):
    return evaluate_consensus([Lineage(**item) for item in data['lineages']], list(data['claims']), minimum_dimensions=int(data['minimum_dimensions']), dissent_preserved=bool(data['dissent_preserved']))


def quorum_evaluate(data):
    return evaluate_quorum([Vote(**item) for item in data['votes']], minimum_independent_clusters=int(data['minimum_independent_clusters']), human_accept_required=bool(data.get('human_accept_required', True)))


def release_validate(data):
    return validate_release_bundle(data['bundle'])


def coalition_charter(value):
    members = tuple(CoalitionMember(item['seat_id'], frozenset(item['roles']), frozenset(item['actions']), frozenset(item['privacy_scope'])) for item in value['members'])
    return CoalitionCharter(value['coalition_id'], value['task_id'], value['human_owner'], members, frozenset(value['parent_actions']), frozenset(value['parent_privacy']), int(value['issued_tick']), int(value['expires_tick']), int(value['depth']), bool(value.get('dissolved', False)))


def coalition_validate(data):
    return validate_coalition(coalition_charter(data['charter']), now_tick=int(data['now_tick']), max_members=int(data['max_members']), max_depth=int(data['max_depth']))


def coalition_dissolve(data):
    return dissolve(coalition_charter(data['charter']), set(data['active_leases']))


def contestability_evaluate(data):
    return evaluate_challenge(Challenge(**data['challenge']), expected_scope=data['expected_scope'], explanation=data['explanation'], resolver_id=data['resolver_id'], producer_id=data['producer_id'])


def freshness_evaluate(data):
    nodes = []
    for item in data['nodes']:
        value = dict(item); value['parents'] = tuple(value.get('parents', ())); nodes.append(EvidenceNode(**value))
    return evaluate_freshness(nodes, now_tick=int(data['now_tick']))


def information_barrier_authorize(data):
    return authorize_exchange(sender_role=data['sender_role'], receiver_role=data['receiver_role'], payload_class=data['payload_class'], phase=data['phase'], receiver_output_sealed=bool(data['receiver_output_sealed']))


def intake_rehearsal_validate(data):
    return validate_intake_rehearsal(data['bundle'])


def proof_frontier_minimal(data):
    return minimal_proof_frontier(set(data['obligations']), {key: set(value) for key, value in data['coverage'].items()})


def proof_frontier_novelty(data):
    return evaluate_novelty(delta_digest=data['delta_digest'], prior_digests=set(data['prior_digests']), new_test=bool(data['new_test']), new_evidence=bool(data['new_evidence']), new_boundary=bool(data['new_boundary']))


def proof_frontier_select(data):
    return select_change_tests(root_change=bool(data['root_change']), semantic_change=bool(data['semantic_change']), module_test=data['module_test'], all_tests=set(data['all_tests']))


def lease_node(value):
    return LeaseNode(value['lease_id'], value.get('parent_id'), value['holder'], frozenset(value['actions']), bool(value.get('revoked', False)), bool(value.get('acknowledged', False)))


def revocation_cascade(data):
    return cascade_revoke([lease_node(item) for item in data['nodes']], data['root_id'])


def revocation_authorize(data):
    return authorize([lease_node(item) for item in data['nodes']], data['lease_id'], data['action'])


def revocation_resume(data):
    return resume_with_new_lease(lease_node(data['old']), lease_node(data['new']), human_receipt=bool(data['human_receipt']))


def role_reassignment_validate(data):
    assignments = [Assignment(item['seat_id'], frozenset(item['roles']), frozenset(item['authority'])) for item in data['assignments']]
    return validate_reassignment(assignments, parent_authority=set(data['parent_authority']), human_approved=bool(data['human_approved']))


def topology_failover(data):
    value = data['lock']; lock = SeatRouteLock(value['identity_id'], value['current_route'], frozenset(value['approved_routes']), frozenset(value['authority_actions']), int(value['privacy_scope']))
    return failover(lock, requested_route=data['requested_route'], claimed_identity=data['claimed_identity'], requested_actions=set(data['requested_actions']), requested_privacy_scope=int(data['requested_privacy_scope']))


def topology_reconcile(data):
    return reconcile_partition(data['left'], data['right'])


def authority_epoch_validate(data):
    return validate_packet(AuthorityPacket(**data['packet']), current_epoch=int(data['current_epoch']), current_seq=int(data['current_seq']), allowed_actions=set(data['allowed_actions']))


def authority_epoch_rotate(data):
    return rotate_epoch(int(data['current_epoch']), human_receipt=bool(data['human_receipt']))


def causal_reconciliation(data):
    a = VersionedPacket(**data['a']); b = VersionedPacket(**data['b'])
    return causal_reconcile(a, b, current_epoch=int(data['current_epoch']))


def delegation_closure(data):
    return evaluate_parent_close(data['parent_id'], [ChildDelegation(**item) for item in data['children']])


def final_gate(data):
    return evaluate_final_gate(data['bundle'])


def human_handoff(data):
    return validate_handoff_kit(data['kit'])


def intake_evaluate(data):
    return evaluate_intake(IntakeEvidence(**data['evidence']))


def migration_adapt(data):
    return adapt_payload(data['payload'], set(data['allowlist']), set(data['required']))


def observability_event(data):
    return validate_event(data['event'])


def observability_service(data):
    return evaluate_service(int(data['latency_ms']), int(data['latency_budget_ms']), bool(data['correctness_proven']), list(data['evidence_refs']))


def readiness_gate(data):
    return evaluate_readiness(data['bundle'])


OPERATIONS = {
    'adapter.conformance': adapter_conformance,
    'appeal.evaluate': appeal_evaluate,
    'attention.schedule-reviews': attention_schedule,
    'attestation.validate': attestation_validate,
    'claims.evaluate': claims_evaluate,
    'claims.reopen': claims_reopen,
    'compatibility.validate-adapter': compatibility_validate_adapter,
    'human-decision.validate': human_decision_validate,
    'independence.evaluate-consensus': independence_evaluate,
    'quorum.evaluate': quorum_evaluate,
    'release.validate': release_validate,
    'coalition.validate': coalition_validate,
    'coalition.dissolve': coalition_dissolve,
    'contestability.evaluate': contestability_evaluate,
    'freshness.evaluate': freshness_evaluate,
    'information-barrier.authorize': information_barrier_authorize,
    'intake-rehearsal.validate': intake_rehearsal_validate,
    'proof-frontier.minimal': proof_frontier_minimal,
    'proof-frontier.novelty': proof_frontier_novelty,
    'proof-frontier.select-tests': proof_frontier_select,
    'revocation.cascade': revocation_cascade,
    'revocation.authorize': revocation_authorize,
    'revocation.resume': revocation_resume,
    'role-reassignment.validate': role_reassignment_validate,
    'topology.failover': topology_failover,
    'topology.reconcile-partition': topology_reconcile,
    'authority-epoch.validate': authority_epoch_validate,
    'authority-epoch.rotate': authority_epoch_rotate,
    'causal-reconciliation.reconcile': causal_reconciliation,
    'delegation-closure.evaluate': delegation_closure,
    'final-gate.evaluate': final_gate,
    'human-handoff.validate': human_handoff,
    'intake.evaluate': intake_evaluate,
    'migration.adapt': migration_adapt,
    'observability.validate-event': observability_event,
    'observability.evaluate-service': observability_service,
    'readiness-gate.evaluate': readiness_gate,
}
