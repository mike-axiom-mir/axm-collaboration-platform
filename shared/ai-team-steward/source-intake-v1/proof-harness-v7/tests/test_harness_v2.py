from __future__ import annotations
import copy
import unittest
from axm_team_harness.adapter import check_conformance
from axm_team_harness.concurrency import ArtifactCell, has_wait_cycle
from axm_team_harness.fuzzing import deterministic_mutations
from axm_team_harness.impact_cache import EvidenceCache, impact_plan
from axm_team_harness.intake import IntakeEvidence, evaluate_intake
from axm_team_harness.lifecycle import transition
from axm_team_harness.migration import adapt_payload, check_roundtrip, migrate_v1_to_v2
from axm_team_harness.observability import evaluate_service, validate_event
from axm_team_harness.offline import BoundedOfflineQueue, reconcile
from axm_team_harness.registry import load_registry
from axm_team_harness.runner import load_fixture
from axm_team_harness.runner_v2 import run_all_v2
from axm_team_harness.scenarios_v2 import run_scenarios_v2
from axm_team_harness.validator import validate_fixture

class HarnessV2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = load_registry()

    def test_11_registry_v2(self):
        self.assertEqual(self.registry['registry_version'], '2.0.0')
        self.assertEqual(len(self.registry['entries']), 100)
        self.assertEqual(len({e['lifecycle_profile'] for e in self.registry['entries']}), 100)
        self.assertEqual(len({e['intake_profile']['candidate_id'] for e in self.registry['entries']}), 100)

    def test_12_lifecycle_guards(self):
        for e in self.registry['entries']:
            self.assertTrue(transition('DRAFT', 'VALIDATED').ok)
            self.assertTrue(transition('DELIVERED', 'ACCEPTED', acceptance_receipt=e['proof_slice_id']).ok)
            self.assertFalse(transition('DRAFT', 'MERGED').ok)
            self.assertFalse(transition('MERGE_PROPOSED', 'MERGED').ok)
            self.assertTrue(transition('MERGE_PROPOSED', 'MERGED', human_decision_receipt='human').ok)

    def test_13_concurrency_idempotency_and_deadlock(self):
        for e in self.registry['entries']:
            cell=ArtifactCell(); self.assertTrue(cell.acquire('a', e['concurrency_key'])[0])
            first=cell.cas_write('a', e['concurrency_key'], 0, 'v', 'k')
            duplicate=cell.cas_write('a', e['concurrency_key'], 0, 'different', 'k')
            self.assertEqual(first, duplicate)
            self.assertEqual(cell.revision, 1)
            self.assertFalse(cell.cas_write('a', e['concurrency_key'], 0, 'stale', 'k2')['ok'])
        self.assertTrue(has_wait_cycle({'a':{'b'}, 'b':{'a'}}))
        self.assertFalse(has_wait_cycle({'a':{'b'}, 'b':set()}))

    def test_14_migration_and_loss_receipts(self):
        for e in self.registry['entries']:
            migrated, receipt = migrate_v1_to_v2(e)
            self.assertTrue(receipt['ok'])
            self.assertTrue(check_roundtrip(e, migrated))
            self.assertFalse(adapt_payload({'module_id':'m','authority':{}}, {'module_id'}, {'module_id','authority'})['ok'])

    def test_15_offline_reconciliation(self):
        for e in self.registry['entries']:
            q=BoundedOfflineQueue(e['offline_policy']['queue_limit'])
            self.assertEqual(q.enqueue({'packet_id':'p'}), (True,'QUEUED'))
            self.assertEqual(q.enqueue({'packet_id':'p'}), (True,'DUPLICATE_SUPPRESSED'))
            self.assertEqual(len(q.packets), 1)
            self.assertFalse(q.enqueue({'packet_id':'x','authority_expired':True})[0])
            self.assertFalse(reconcile({'packet_id':'l','base_revision':1,'value':'a'}, {'packet_id':'r','base_revision':1,'value':'b'})['ok'])

    def test_16_cache_and_impact(self):
        for e in self.registry['entries']:
            c=EvidenceCache(); self.assertEqual(c.execute(e,'v',lambda:True)[1], 'CACHE_MISS')
            self.assertEqual(c.execute(e,'v',lambda:False)[1], 'CACHE_HIT')
            changed=copy.deepcopy(e); changed['hold_rule']+='x'
            self.assertEqual(c.execute(changed,'v',lambda:True)[1], 'CACHE_MISS')
        self.assertLess(impact_plan(self.registry['entries'], ['axm.team.task-intent-packet'])['selected_count'], 100)
        self.assertEqual(impact_plan(self.registry['entries'], [], True)['selected_count'], 100)

    def test_17_adapter_conformance(self):
        for e in self.registry['entries']:
            src={'module_id':e['module_id'],'proof_slice_id':e['proof_slice_id'],'authority':{'allowed_actions':['read']},'privacy':{'classification':'private'},'evidence':{}}
            self.assertTrue(check_conformance(src, copy.deepcopy(src), required_fields=set(e['adapter_profile']['required_fields']))['ok'])
            bad=copy.deepcopy(src); bad['authority']['allowed_actions'].append('write')
            self.assertFalse(check_conformance(src,bad,required_fields=set(e['adapter_profile']['required_fields']))['ok'])

    def test_18_observability_is_not_proof(self):
        for e in self.registry['entries']:
            ev={'event_id':e['observability_profile']['trace_id'],'module_id':e['module_id'],'event_type':'X','timestamp':'t','actor_ref':'a','new_state':'VALIDATED','evidence_refs':['r']}
            self.assertTrue(validate_event(ev)['ok'])
            self.assertFalse(evaluate_service(1,10,False,[])['accepted'])

    def test_19_deterministic_fuzz(self):
        total=0
        for e in self.registry['entries']:
            valid=load_fixture('valid', e['proof_slice_id'])
            muts=deterministic_mutations(valid,e)
            self.assertEqual(len(muts),12)
            for _name, mutant in muts:
                total += 1
                self.assertFalse(validate_fixture(mutant,e).ok)
        self.assertEqual(total,1200)

    def test_20_intake_gate_never_promotes(self):
        for e in self.registry['entries']:
            held=evaluate_intake(IntakeEvidence(True,True,True,True,True,True,None))
            ready=evaluate_intake(IntakeEvidence(True,True,True,True,True,True,e['intake_profile']['owner_key']))
            self.assertEqual(held['status'],'HELD_FOR_INTAKE')
            self.assertEqual(ready['status'],'READY_FOR_LOCAL_INTAKE_CANDIDATE')
            self.assertFalse(ready['integrated']); self.assertFalse(ready['canon'])

    def test_21_compound_scenarios_v2(self):
        result=run_scenarios_v2()
        self.assertEqual(result['scenario_count'],10)
        self.assertTrue(result['passed'])

    def test_22_full_runner_v2(self):
        result=run_all_v2()
        self.assertTrue(result['passed'])
        self.assertEqual(result['fuzz']['total_mutations'],1200)
        self.assertEqual(result['fuzz']['rejected_mutations'],1200)
        for k,v in result['counts'].items(): self.assertEqual(v,100,k)

if __name__ == '__main__':
    unittest.main()
