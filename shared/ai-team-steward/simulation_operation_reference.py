from __future__ import annotations

from axm_team_harness.concurrency import ArtifactCell
from axm_team_harness.impact_cache import impact_plan
from axm_team_harness.incident import IncidentController
from axm_team_harness.offline import BoundedOfflineQueue
from axm_team_harness.orchestrator_v3 import DryRunOrchestrator
from axm_team_harness.proof_graph import ProofGraph, reusable_evidence
from axm_team_harness.saga_v4 import SagaStep, execute_saga


def impact_plan_operation(data):
    return impact_plan(
        data['entries'],
        data['changed_module_ids'],
        bool(data.get('changed_root_contract', False)),
    )


def proof_graph_select_tests(data):
    graph = ProofGraph()
    for node in data['nodes']:
        graph.add(
            str(node['node_id']),
            digest=str(node.get('digest', '')),
            kind=str(node.get('kind', '')),
            fresh=bool(node.get('fresh', True)),
        )
    for node_id, dependencies in data.get('edges', {}).items():
        for dependency in dependencies:
            graph.depends_on(str(node_id), str(dependency))
    return graph.select_tests(
        {str(value) for value in data['changed']},
        {str(value) for value in data.get('all_tests', [])},
    )


def proof_graph_reusable_evidence(data):
    return reusable_evidence(data['prior'], data['current'])


def orchestrator_dry_run(data):
    orchestrator = DryRunOrchestrator(stopped=bool(data.get('stopped', False)))
    return orchestrator.execute(
        task_id=str(data.get('task_id', '')),
        authority_ok=bool(data.get('authority_ok', False)),
        handoff_accepted=bool(data.get('handoff_accepted', False)),
        independent_verification=bool(data.get('independent_verification', False)),
        human_decision=data.get('human_decision'),
        orchestrator_self_approval=bool(data.get('orchestrator_self_approval', False)),
    )


def incident_simulate(data):
    controller = IncidentController()
    results = []
    for action in data['actions']:
        kind = str(action.get('type', ''))
        if kind == 'trip':
            results.append(controller.trip(
                [str(value) for value in action.get('task_tree', [])],
                [str(value) for value in action.get('leases', [])],
                action.get('reason'),
            ))
        elif kind == 'may_act':
            ok, code = controller.may_act(
                str(action.get('task_id', '')),
                str(action.get('lease_id', '')),
            )
            results.append({
                'type': 'may_act',
                'task_id': action.get('task_id'),
                'lease_id': action.get('lease_id'),
                'ok': ok,
                'code': code,
            })
        elif kind == 'restart':
            results.append(controller.restart(
                [str(value) for value in action.get('task_tree', [])],
                [str(value) for value in action.get('leases', [])],
                human_receipt=action.get('human_receipt'),
                recovery_checks_passed=bool(action.get('recovery_checks_passed', False)),
                new_authority_receipt=action.get('new_authority_receipt'),
            ))
        else:
            raise ValueError('incident action.type must be trip, may_act, or restart')
    return {
        'ok': all(
            result.get('ok', True) is not False
            and result.get('code') != 'INCIDENT_STOP_ACTIVE'
            for result in results
        ),
        'results': results,
        'state': {
            'stopped': sorted(controller.stopped),
            'frozen_leases': sorted(controller.frozen_leases),
            'evidence': controller.evidence,
        },
    }


def offline_queue(data):
    queue = BoundedOfflineQueue(int(data['limit']))
    receipts = []
    for packet in data['packets']:
        ok, code = queue.enqueue(packet)
        receipts.append({
            'packet_id': str(packet.get('packet_id', '')),
            'ok': ok,
            'code': code,
        })
    return {
        'ok': all(receipt['ok'] for receipt in receipts),
        'receipts': receipts,
        'packets': queue.packets,
        'ids': sorted(queue.ids),
    }


def workspace_artifact_cell(data):
    initial = data.get('initial') or {}
    cell = ArtifactCell(
        revision=int(initial.get('revision', 0)),
        value=initial.get('value'),
        lease_holder=initial.get('lease_holder'),
        lease_id=initial.get('lease_id'),
    )
    receipts = []
    for action in data['actions']:
        kind = str(action.get('type', ''))
        if kind == 'acquire':
            ok, code = cell.acquire(action.get('holder'), action.get('lease_id'))
            receipts.append({'type': 'acquire', 'ok': ok, 'code': code})
        elif kind == 'release':
            ok, code = cell.release(action.get('holder'), action.get('lease_id'))
            receipts.append({'type': 'release', 'ok': ok, 'code': code})
        elif kind == 'write':
            receipts.append({
                'type': 'write',
                **cell.cas_write(
                    action.get('holder'),
                    action.get('lease_id'),
                    int(action['expected_revision']),
                    action.get('value'),
                    action.get('idempotency_key'),
                ),
            })
        else:
            raise ValueError('artifact action.type must be acquire, release, or write')
    return {
        'ok': all(receipt['ok'] for receipt in receipts),
        'receipts': receipts,
        'state': {
            'revision': cell.revision,
            'value': cell.value,
            'lease_holder': cell.lease_holder,
            'lease_id': cell.lease_id,
            'idempotency_keys': sorted(cell.idempotency_receipts),
        },
    }


def recovery_saga(data):
    steps = [
        SagaStep(str(step['name']), bool(step.get('reversible', True)))
        for step in data['steps']
    ]
    return execute_saga(
        steps,
        fail_at=data.get('fail_at'),
        human_irreversible_approval=bool(data.get('human_irreversible_approval', False)),
        compensation_fail_at=data.get('compensation_fail_at'),
    )


OPERATIONS = {
    'impact.plan': impact_plan_operation,
    'proof-graph.select-tests': proof_graph_select_tests,
    'proof-graph.reusable-evidence': proof_graph_reusable_evidence,
    'orchestrator.dry-run': orchestrator_dry_run,
    'incident.simulate': incident_simulate,
    'offline.queue': offline_queue,
    'workspace.artifact-cell': workspace_artifact_cell,
    'recovery.saga': recovery_saga,
}
