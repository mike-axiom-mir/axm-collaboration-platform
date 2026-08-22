from __future__ import annotations
import unittest
from axm_translation_core import new_provenance,merge_provenance,release_decision
class Run43ProvenanceTests(unittest.TestCase):
    def test_new(self): self.assertEqual(new_provenance(source_id='a')['classification'],'internal')
    def test_required_source(self):
        with self.assertRaises(ValueError): new_provenance(source_id='')
    def test_bad_classification(self):
        with self.assertRaises(ValueError): new_provenance(source_id='a',classification='unknown')
    def test_merge_keeps_strongest(self):
        r=merge_provenance([new_provenance(source_id='a',classification='public'),new_provenance(source_id='b',classification='sensitive')],operation='merge',module_id='m'); self.assertEqual(r['classification'],'sensitive')
    def test_merge_sources(self):
        r=merge_provenance([new_provenance(source_id='b'),new_provenance(source_id='a')],operation='merge',module_id='m'); self.assertEqual(r['source_ids'],['a','b'])
    def test_merge_scope_intersection(self):
        r=merge_provenance([new_provenance(source_id='a',consent_scopes=['x','y']),new_provenance(source_id='b',consent_scopes=['y','z'])],operation='merge',module_id='m'); self.assertEqual(r['consent_scopes'],['y'])
    def test_merge_lineage(self): self.assertEqual(merge_provenance([new_provenance(source_id='a')],operation='translate',module_id='m')['lineage'][-1]['operation'],'translate')
    def test_empty_merge_refused(self):
        with self.assertRaises(ValueError): merge_provenance([],operation='x',module_id='m')
    def test_same_level_release(self): self.assertEqual(release_decision(new_provenance(source_id='a',classification='internal'),target_max_classification='internal')['verdict'],'ALLOW')
    def test_upgrade_target_release(self): self.assertEqual(release_decision(new_provenance(source_id='a',classification='public'),target_max_classification='internal')['verdict'],'ALLOW')
    def test_downgrade_refused(self): self.assertIn('classification_downgrade_not_approved',release_decision(new_provenance(source_id='a',classification='secret'),target_max_classification='public')['errors'])
    def test_explicit_downgrade(self): self.assertEqual(release_decision(new_provenance(source_id='a',classification='secret'),target_max_classification='public',explicit_downgrade_approval=True)['verdict'],'ALLOW')
    def test_scope_required(self): self.assertIn('required_consent_scope_missing',release_decision(new_provenance(source_id='a'),target_max_classification='internal',required_scope='share')['errors'])
    def test_scope_present(self): self.assertEqual(release_decision(new_provenance(source_id='a',consent_scopes=['share']),target_max_classification='internal',required_scope='share')['verdict'],'ALLOW')
    def test_decision_does_not_release(self): self.assertFalse(release_decision(new_provenance(source_id='a'),target_max_classification='internal')['released'])
if __name__=='__main__': unittest.main()
