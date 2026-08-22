from __future__ import annotations
import hashlib, json, sys, unittest
from jsonschema import Draft202012Validator
from pathlib import Path

BASE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(BASE/'module1_adapter'))
sys.path.insert(0,str(BASE/'interop_preflight'))
from module1_adapter import assess
from materialization_state import IntakeGates, evaluate
from semantic_identity import classify_pair
from nested_bundle_probe import probe_module1_bundle
from preflight_three_module_intake_v3 import run as preflight_v3

class Module1AdapterTests(unittest.TestCase):
    def test_handoff_profile_and_hash_are_grounded(self):
        r=assess()
        self.assertTrue(r['profile_valid'])
        self.assertTrue(r['handoff']['hash_matches'])
        self.assertEqual(r['identity']['external_canonical_id'],'axm.module.human_capability_atlas')
        self.assertFalse(r['merge_claim'])

    def test_initial_state_refuses_fake_materialization(self):
        r=assess()
        self.assertEqual(r['current_materialization_state']['state'],'WAITING_FOR_ARTIFACT_BYTES')
        self.assertTrue(r['source_snapshot']['real_registry_run']=='NOT_RUN')
        self.assertFalse(r['source_snapshot']['source_commit_captured'])

    def test_materialization_state_separates_package_from_corpus(self):
        g=IntakeGates(artifact_bytes_present=True,outer_hash_matches=True,archive_probe_passed=True,nested_hashes_match=True,exact_contract_match=True)
        r=evaluate(g)
        self.assertEqual(r['state'],'PACKAGE_REHEARSAL_PASS_MATERIALIZATION_REQUIRED')
        self.assertTrue(r['package_admission_eligible'])
        self.assertTrue(r['materialization_required'])
        self.assertFalse(r['merge_review_eligible'])

    def test_truth_namespace_does_not_promote_known_to_runtime_proof(self):
        p=json.loads((BASE/'module1_adapter/MODULE1_INTAKE_PROFILE.json').read_text())
        self.assertEqual(p['truth_namespace']['default_module3_ceiling']['known'],'DECLARED')
        self.assertFalse(p['truth_namespace']['confirmed_is_canonical'])
        self.assertTrue(all(v is False for v in p['proof_ceiling'].values()))

    def test_semantic_identity_distinguishes_run_metadata_from_conflict(self):
        base={'capability_id':'axm.file.rename','capability_revision':'1.0.0','normalized_source_semantic_sha256':'sha256:'+'1'*64,'capability_card_canonical_sha256':'sha256:'+'a'*64}
        run_variant=classify_pair(base,{**base,'capability_card_canonical_sha256':'sha256:'+'b'*64})
        conflict=classify_pair(base,{**base,'normalized_source_semantic_sha256':'sha256:'+'2'*64,'capability_card_canonical_sha256':'sha256:'+'c'*64})
        separate=classify_pair(base,{**base,'capability_id':'axm.file.move'})
        self.assertEqual(run_variant['classification'],'run_metadata_variant')
        self.assertFalse(run_variant['merge_hold'])
        self.assertEqual(conflict['classification'],'conflicting_duplicate')
        self.assertTrue(conflict['merge_hold'])
        self.assertEqual(separate['classification'],'separate_identity')

    def test_nested_bundle_probe_verifies_nested_hashes_and_paths(self):
        profile=json.loads((BASE/'module1_adapter/fixtures/nested_fixture_profile.json').read_text())
        good=probe_module1_bundle(BASE/'module1_adapter/fixtures/nested_good.zip',profile)
        tampered=probe_module1_bundle(BASE/'module1_adapter/fixtures/nested_tampered.zip',profile)
        unsafe_profile=json.loads((BASE/'module1_adapter/fixtures/nested_unsafe_profile.json').read_text())
        unsafe=probe_module1_bundle(BASE/'module1_adapter/fixtures/nested_unsafe.zip',unsafe_profile)
        self.assertTrue(good['active_package_admission_safe'])
        self.assertFalse(tampered['active_package_admission_safe'])
        self.assertTrue(any('hash mismatch' in x.lower() for x in tampered['blockers']))
        self.assertFalse(unsafe['active_package_admission_safe'])
        self.assertTrue(any('traversal' in x.lower() for x in unsafe['blockers']))

    def test_preintake_v3_defers_real_cross_module_checks(self):
        d=BASE/'module1_adapter/fixtures/preintake_triplet'
        r=preflight_v3([d/'module1.json',d/'module2.json',d/'module3.json'])
        self.assertEqual(r['status'],'PACKAGE_REHEARSAL_PASS_MATERIALIZATION_REQUIRED')
        self.assertTrue(r['package_admission_allowed'])
        self.assertTrue(r['materialization_required'])
        self.assertFalse(r['merge_review_allowed'])
        statuses={x['check_id']:x['status'] for x in r['checks']}
        self.assertEqual(statuses['atlas-to-interface-capabilities'],'DEFERRED')
        self.assertEqual(statuses['atlas-to-evolution-capabilities'],'DEFERRED')

    def test_preintake_v3_accepts_complete_corpus_only_for_review(self):
        d=BASE/'module1_adapter/fixtures/complete_triplet'
        r=preflight_v3([d/'module1.json',d/'module2.json',d/'module3.json'])
        self.assertEqual(r['status'],'CORPUS_REHEARSAL_PASS')
        self.assertTrue(r['merge_review_allowed'])
        self.assertFalse(r['active_merge_allowed'])

    def test_preintake_v3_holds_semantic_conflict(self):
        d=BASE/'module1_adapter/fixtures/conflict_triplet'
        r=preflight_v3([d/'module1.json',d/'module2.json',d/'module3.json'])
        self.assertEqual(r['status'],'MERGE_HOLD')
        self.assertTrue(r['package_admission_allowed'])
        self.assertFalse(r['merge_review_allowed'])
        self.assertTrue(any(x['classification']=='conflicting_duplicate' for x in r['record_collisions']))


    def test_v3_manifests_and_reports_validate(self):
        ms=json.loads((BASE/'interop_preflight/intake_manifest_v2.schema.json').read_text())
        rs=json.loads((BASE/'interop_preflight/preflight_report_v3.schema.json').read_text())
        Draft202012Validator.check_schema(ms);Draft202012Validator.check_schema(rs)
        for folder in ['preintake_triplet','complete_triplet','conflict_triplet']:
            d=BASE/'module1_adapter/fixtures'/folder
            manifests=[json.loads((d/x).read_text()) for x in ['module1.json','module2.json','module3.json']]
            for m in manifests:Draft202012Validator(ms).validate(m)
            r=preflight_v3([d/'module1.json',d/'module2.json',d/'module3.json'])
            Draft202012Validator(rs).validate(r)

    def test_v06_canonical_body_is_unchanged(self):
        def file_hash(p:Path)->str:return 'sha256:'+hashlib.sha256(p.read_bytes()).hexdigest()
        def tree_hash(p:Path)->str:
            h=hashlib.sha256()
            for f in sorted(p.rglob('*')):
                if f.is_file():
                    h.update(f.relative_to(p).as_posix().encode());h.update(b'\0');h.update(hashlib.sha256(f.read_bytes()).digest())
            return 'sha256:'+h.hexdigest()
        self.assertEqual(tree_hash(BASE/'registry'),'sha256:47ca9512ced3d25be1de8a89e22f00a19ae92c5875a06b03628303336ae5d22c')
        self.assertEqual(file_hash(BASE/'event_log/phase3_full_events.jsonl'),'sha256:f48d9328c3b38b74e90577bf6c3a9b1bd726a4a5727b2621fedc734d98c94415')
        self.assertEqual(file_hash(BASE/'graphs/full_graph.json'),'sha256:8b1c74c2c4ef49623f0972f68e5a3fadb40b94dacba201af0d929cb51b7e4850')

if __name__=='__main__':unittest.main()
