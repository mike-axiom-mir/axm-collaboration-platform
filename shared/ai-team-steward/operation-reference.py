from __future__ import annotations

from dataclasses import asdict, is_dataclass
from datetime import datetime
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
HARNESS = ROOT / 'intakes' / 'ai-team-collaboration-runs-01-101-v1' / 'proof-harness-v7'
sys.path.insert(0, str(HARNESS))

from axm_team_harness.authority_v3 import Lease, delegate
from axm_team_harness.compatibility_v4 import ContractSurface, negotiate
from axm_team_harness.concurrency import has_wait_cycle
from axm_team_harness.controls import ControlState, can_act
from axm_team_harness.join_barrier_v5 import UpstreamReceipt, evaluate_join
from axm_team_harness.lifecycle import transition
from axm_team_harness.offline import reconcile
from axm_team_harness.partial_failure_v6 import Step, plan_recovery
from axm_team_harness.privacy_taint import filter_context
from axm_team_harness.proof_compaction_v6 import build_merkle, inclusion_proof, verify
from axm_team_harness.resource_tree import BudgetTree, fair_schedule
from axm_team_harness.workspace_v5 import BranchPatch, merge_patches
from advanced_operation_reference import OPERATIONS as ADVANCED_OPERATIONS
from simulation_operation_reference import OPERATIONS as SIMULATION_OPERATIONS


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


def authority_delegate(data):
    p, c = data['parent'], data['child']
    parent = Lease(
        str(p.get('lease_id', '')), str(p.get('holder', '')),
        frozenset(p['actions']), frozenset(p['targets']), int(p['privacy_scope']),
        int(p['deadline_tick']), int(p['depth']), int(p['max_depth']), bool(p.get('revoked', False))
    )
    return delegate(
        parent, child_id=str(c.get('lease_id', '')), holder=str(c.get('holder', '')),
        actions=c['actions'], targets=c['targets'], privacy_scope=int(c['privacy_scope']),
        deadline_tick=int(c['deadline_tick'])
    )


def handoff_transition(data):
    return transition(
        str(data.get('previous_state', '')), str(data.get('requested_state', '')),
        acceptance_receipt=data.get('acceptance_receipt'), review_receipt=data.get('review_receipt'),
        human_decision_receipt=data.get('human_decision_receipt'), resume_authorization=data.get('resume_authorization')
    )


def deadlock_detect(data):
    found = has_wait_cycle({str(key): set(value) for key, value in data['wait_for'].items()})
    return {'ok': not found, 'status': 'DEADLOCK_HELD' if found else 'CLEAR', 'has_cycle': found}


def workspace_merge(data):
    patches = [BranchPatch(
        str(item.get('branch_id', '')), int(item['base_revision']), str(item.get('writer', '')),
        frozenset(item['paths']), frozenset(item['semantic_keys']), str(item.get('patch_digest', ''))
    ) for item in data['patches']]
    return merge_patches(patches, current_revision=int(data['current_revision']))


def resource_budget(data):
    tree = BudgetTree(int(data['limit']))
    receipts = []
    for action in data['actions']:
        kind, child = str(action.get('type', '')), str(action.get('child', ''))
        if kind == 'reserve':
            amount = int(action['amount']); ok, code = tree.reserve(child, amount)
            receipts.append({'type': kind, 'child': child, 'amount': amount, 'ok': ok, 'code': code})
        elif kind == 'consume':
            amount = int(action['amount']); ok, code = tree.consume(child, amount)
            receipts.append({'type': kind, 'child': child, 'amount': amount, 'ok': ok, 'code': code})
        elif kind == 'release':
            released = tree.release(child)
            receipts.append({'type': kind, 'child': child, 'released': released, 'ok': True, 'code': 'RELEASED'})
        else:
            raise ValueError('action.type must be reserve, consume, or release')
    return {'ok': all(row['ok'] for row in receipts), 'receipts': receipts, 'state': {'limit': tree.limit, 'reservations': tree.reservations, 'consumed': tree.consumed, 'reserved': tree.reserved}}


def resource_fair_schedule(data):
    return {'ok': True, 'schedule': fair_schedule(data['items'], int(data['slots']))}


def privacy_filter(data):
    return filter_context(data['fields'], maximum_label=str(data['maximum_label']), allowed_names=set(data['allowed_names']))


def join_evaluate(data):
    receipts = [UpstreamReceipt(
        str(item.get('task_id', '')), bool(item.get('accepted')), str(item.get('evidence_digest', '')),
        bool(item.get('fresh')), str(item.get('status', 'RETURNED'))
    ) for item in data['receipts']]
    return evaluate_join(receipts, required_ids=set(data['required_ids']))


def recovery_plan(data):
    steps = [Step(
        str(item.get('step_id', '')), tuple(item['dependencies']), bool(item.get('applied')),
        bool(item.get('succeeded')), bool(item.get('reversible'))
    ) for item in data['steps']]
    return plan_recovery(steps, human_approved_irreversible=bool(data.get('human_approved_irreversible', False)))


def proof_merkle(data):
    values = [str(value) for value in data['values']]
    index = int(data['index'])
    tree = build_merkle(values)
    proof = inclusion_proof(tree, index)
    checked = str(data['verify_value']) if 'verify_value' in data else values[index]
    verified = verify(checked, index, proof, tree['root'])
    return {'ok': verified, 'status': 'PROOF_VERIFIED' if verified else 'PROOF_TAMPERED_HELD', 'root': tree['root'], 'leaf_count': tree['leaf_count'], 'index': index, 'proof': proof, 'verified': verified}


def offline_reconcile(data):
    return reconcile(data['local'], data['remote'])


def compatibility_negotiate(data):
    def surface(value):
        return ContractSurface(
            int(value['major']), int(value['minor']), frozenset(value['capabilities']),
            frozenset(value['authority_actions']), frozenset(value['evidence_fields']),
            bool(value.get('deprecated', False))
        )
    return negotiate(
        surface(data['producer']), surface(data['consumer']),
        required_capabilities=set(data['required_capabilities']), required_evidence=set(data['required_evidence'])
    )


def controls_can_act(data):
    value = data['state']
    state = ControlState(
        stopped=bool(value.get('stopped', False)), revoked=bool(value.get('revoked', False)),
        expires_at=str(value.get('expires_at', '2099-12-31T23:59:59Z')),
        resume_authorization=value.get('resume_authorization'), reason=value.get('reason')
    )
    ok, code = can_act(state, datetime.fromisoformat(str(data['now']).replace('Z', '+00:00')))
    return {'ok': ok, 'code': code}


OPERATIONS = {
    'authority.delegate': authority_delegate,
    'handoff.transition': handoff_transition,
    'deadlock.detect': deadlock_detect,
    'workspace.merge-proposal': workspace_merge,
    'resource.budget': resource_budget,
    'resource.fair-schedule': resource_fair_schedule,
    'privacy.filter-context': privacy_filter,
    'join.evaluate': join_evaluate,
    'recovery.plan': recovery_plan,
    'proof.merkle': proof_merkle,
    'offline.reconcile': offline_reconcile,
    'compatibility.negotiate': compatibility_negotiate,
    'controls.can-act': controls_can_act,
}
OPERATIONS.update(ADVANCED_OPERATIONS)
OPERATIONS.update(SIMULATION_OPERATIONS)


def main():
    request = json.load(sys.stdin)
    results = []
    for case in request.get('cases', []):
        operation_id = str(case.get('operation_id', ''))
        if operation_id not in OPERATIONS:
            raise ValueError(f'unknown operation: {operation_id}')
        results.append({'operation_id': operation_id, 'variant': case.get('variant'), 'result': plain(OPERATIONS[operation_id](case['input']))})
    json.dump({'results': results}, sys.stdout, ensure_ascii=False, sort_keys=True)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main()
