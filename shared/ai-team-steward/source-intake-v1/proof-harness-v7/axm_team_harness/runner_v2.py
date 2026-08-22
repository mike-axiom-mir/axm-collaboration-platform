from __future__ import annotations
import copy
import json
from typing import Any
from .adapter import check_conformance
from .concurrency import ArtifactCell, has_wait_cycle
from .fuzzing import deterministic_mutations
from .impact_cache import EvidenceCache, impact_plan
from .intake import IntakeEvidence, evaluate_intake
from .lifecycle import transition
from .migration import adapt_payload, check_roundtrip, migrate_v1_to_v2
from .observability import evaluate_service, validate_event
from .offline import BoundedOfflineQueue, reconcile
from .registry import load_registry
from .runner import load_fixture, run_all
from .scenarios_v2 import run_scenarios_v2
from .validator import validate_fixture


def run_all_v2() -> dict[str, Any]:
    registry = load_registry()
    counts = {
        'registry_v2_entries': len(registry['entries']),
        'lifecycle_valid_transitions': 0,
        'lifecycle_illegal_transitions_rejected': 0,
        'concurrency_stale_writes_rejected': 0,
        'concurrency_duplicates_idempotent': 0,
        'deadlock_cycles_detected': 0,
        'migration_roundtrips_preserved': 0,
        'lossy_migrations_held': 0,
        'offline_duplicates_suppressed': 0,
        'offline_conflicts_held': 0,
        'offline_expired_authority_held': 0,
        'cache_misses_recorded': 0,
        'cache_hits_recorded': 0,
        'cache_invalidations_recorded': 0,
        'adapter_conformant_passed': 0,
        'adapter_lossy_rejected': 0,
        'observability_complete_events': 0,
        'slo_not_used_as_correctness_proof': 0,
        'intake_without_owner_held': 0,
        'intake_candidates_ready': 0,
    }
    fuzz_rejected = 0
    fuzz_total = 0
    per_seed = []
    for entry in registry['entries']:
        valid = load_fixture('valid', entry['proof_slice_id'])
        # Run 42 lifecycle
        lifecycle_ok = transition('DRAFT', 'VALIDATED').ok and transition('DELIVERED', 'ACCEPTED', acceptance_receipt='accept').ok
        lifecycle_bad = not transition('DRAFT', 'MERGED').ok
        counts['lifecycle_valid_transitions'] += int(lifecycle_ok)
        counts['lifecycle_illegal_transitions_rejected'] += int(lifecycle_bad)
        # Run 43 concurrency
        cell = ArtifactCell(); cell.acquire('seat-a', entry['concurrency_key'])
        first = cell.cas_write('seat-a', entry['concurrency_key'], 0, entry['module_id'], 'idem')
        duplicate = cell.cas_write('seat-a', entry['concurrency_key'], 0, 'should-not-apply', 'idem')
        stale = cell.cas_write('seat-a', entry['concurrency_key'], 0, 'stale', 'new-key')
        counts['concurrency_stale_writes_rejected'] += int(not stale['ok'] and stale['code']=='STALE_BASE_REVISION')
        counts['concurrency_duplicates_idempotent'] += int(duplicate == first and cell.revision == 1)
        counts['deadlock_cycles_detected'] += int(has_wait_cycle({'a': {'b'}, 'b': {'a'}}))
        # Run 44 migration
        migrated, _ = migrate_v1_to_v2(entry)
        counts['migration_roundtrips_preserved'] += int(check_roundtrip(entry, migrated))
        lossy = adapt_payload({'module_id': entry['module_id'], 'authority': {}, 'privacy': {}}, {'module_id'}, {'module_id','authority'})
        counts['lossy_migrations_held'] += int(not lossy['ok'])
        # Run 45 offline
        q = BoundedOfflineQueue(entry['offline_policy']['queue_limit'])
        q.enqueue({'packet_id': entry['proof_slice_id']})
        dup = q.enqueue({'packet_id': entry['proof_slice_id']})
        exp = q.enqueue({'packet_id': entry['proof_slice_id']+'-expired', 'authority_expired': True})
        conf = reconcile({'packet_id':'l','base_revision':1,'revision':2,'value':'left'}, {'packet_id':'r','base_revision':1,'revision':2,'value':'right'})
        counts['offline_duplicates_suppressed'] += int(dup == (True, 'DUPLICATE_SUPPRESSED') and len(q.packets)==1)
        counts['offline_expired_authority_held'] += int(exp == (False, 'AUTHORITY_EXPIRED_PACKET_HELD'))
        counts['offline_conflicts_held'] += int(not conf['ok'] and conf['code']=='DIVERGENT_SAME_BASE_HELD')
        # Run 46 cache
        cache = EvidenceCache()
        _, c1 = cache.execute(entry, 'test-v2', lambda: {'ok': True})
        _, c2 = cache.execute(entry, 'test-v2', lambda: {'ok': False})
        changed_entry = copy.deepcopy(entry); changed_entry['hold_rule'] += ' changed'
        _, c3 = cache.execute(changed_entry, 'test-v2', lambda: {'ok': True})
        counts['cache_misses_recorded'] += int(c1=='CACHE_MISS')
        counts['cache_hits_recorded'] += int(c2=='CACHE_HIT')
        counts['cache_invalidations_recorded'] += int(c3=='CACHE_MISS')
        # Run 47 adapter
        source = {'module_id': entry['module_id'], 'proof_slice_id': entry['proof_slice_id'],
                  'authority': {'allowed_actions': ['read']}, 'privacy': {'classification':'private'}, 'evidence': {'refs':['e']}}
        good = copy.deepcopy(source)
        bad = copy.deepcopy(source); bad['authority']['allowed_actions'].append('write'); bad.pop('evidence')
        req = set(entry['adapter_profile']['required_fields'])
        counts['adapter_conformant_passed'] += int(check_conformance(source, good, required_fields=req)['ok'])
        counts['adapter_lossy_rejected'] += int(not check_conformance(source, bad, required_fields=req)['ok'])
        # Run 48 observability
        event = {'event_id':entry['observability_profile']['trace_id'], 'module_id':entry['module_id'], 'event_type':'TEST',
                 'timestamp':'2026-07-27T00:00:00Z', 'actor_ref':'harness', 'new_state':'VALIDATED', 'evidence_refs':['ev']}
        counts['observability_complete_events'] += int(validate_event(event)['ok'])
        service = evaluate_service(5, 50, False, [])
        counts['slo_not_used_as_correctness_proof'] += int(service['slo_met'] and not service['accepted'])
        # Run 49 fuzz
        seed_fuzz_ok = True
        for _name, mutant in deterministic_mutations(valid, entry):
            fuzz_total += 1
            rejected = not validate_fixture(mutant, entry).ok
            fuzz_rejected += int(rejected)
            seed_fuzz_ok = seed_fuzz_ok and rejected
        # Run 50 intake
        held = evaluate_intake(IntakeEvidence(True, True, True, True, True, True, None))
        ready = evaluate_intake(IntakeEvidence(True, True, True, True, True, True, f"owner-{entry['seed_number']:03d}"))
        counts['intake_without_owner_held'] += int(held['status']=='HELD_FOR_INTAKE')
        counts['intake_candidates_ready'] += int(ready['status']=='READY_FOR_LOCAL_INTAKE_CANDIDATE' and not ready['integrated'] and not ready['canon'])
        per_seed.append({
            'seed_number': entry['seed_number'], 'module_id': entry['module_id'], 'proof_slice_id': entry['proof_slice_id'],
            'lifecycle_pass': lifecycle_ok and lifecycle_bad,
            'concurrency_pass': not stale['ok'] and duplicate == first,
            'migration_pass': check_roundtrip(entry, migrated) and not lossy['ok'],
            'offline_pass': dup[1]=='DUPLICATE_SUPPRESSED' and not conf['ok'] and not exp[0],
            'cache_pass': (c1,c2,c3)==('CACHE_MISS','CACHE_HIT','CACHE_MISS'),
            'adapter_pass': check_conformance(source, good, required_fields=req)['ok'] and not check_conformance(source, bad, required_fields=req)['ok'],
            'observability_pass': validate_event(event)['ok'] and not service['accepted'],
            'fuzz_pass': seed_fuzz_ok,
            'intake_pass': held['status']=='HELD_FOR_INTAKE' and ready['status']=='READY_FOR_LOCAL_INTAKE_CANDIDATE',
        })
    base = run_all()
    scenarios = run_scenarios_v2()
    sparse = impact_plan(registry['entries'], ['axm.team.task-intent-packet'])
    root = impact_plan(registry['entries'], ['axm.team.bounded-collaboration-orchestrator'], changed_root_contract=True)
    counts_ok = all(v == 100 for v in counts.values())
    passed = (base['passed'] and counts_ok and fuzz_total == 1200 and fuzz_rejected == 1200 and scenarios['passed']
              and sparse['selected_count'] < 100 and root['selected_count'] == 100 and all(all(v for k,v in row.items() if k.endswith('_pass')) for row in per_seed))
    return {
        'harness_version': '0.2.0',
        'evidence_scope': 'DETERMINISTIC_INTEGRATION_HARNESS_ONLY_NOT_AXM_RUNTIME',
        'base_harness_passed': base['passed'],
        'counts': counts,
        'fuzz': {'total_mutations': fuzz_total, 'rejected_mutations': fuzz_rejected},
        'scenario_suite_v2': scenarios,
        'impact_examples': {'sparse': sparse, 'root': root},
        'per_seed': per_seed,
        'passed': passed,
    }

if __name__ == '__main__':
    print(json.dumps(run_all_v2(), ensure_ascii=False, indent=2))
