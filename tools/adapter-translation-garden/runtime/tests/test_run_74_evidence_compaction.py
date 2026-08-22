import unittest
from axm_translation_core import compact_evidence_bundle,expand_evidence_bundle,verify_compact_evidence_bundle,evidence_reduction_report
ITEMS=[{'id':'a','payload':{'x':1}},{'id':'b','payload':{'x':1}},{'id':'c','payload':{'x':2}}]
class EvidenceCompactionTests(unittest.TestCase):
    def test_deduplicates(self): self.assertEqual(compact_evidence_bundle(ITEMS)['unique_object_count'],2)
    def test_preserves_item_count(self): self.assertEqual(compact_evidence_bundle(ITEMS)['item_count'],3)
    def test_root_preserved(self): self.assertTrue(verify_compact_evidence_bundle(compact_evidence_bundle(ITEMS,['a']))['roots_valid'])
    def test_missing_root_holds(self): self.assertEqual(compact_evidence_bundle(ITEMS,['x'])['decision'],'HOLD')
    def test_expands_exactly(self): self.assertEqual(expand_evidence_bundle(compact_evidence_bundle(ITEMS))['items'],ITEMS)
    def test_verifies(self): self.assertTrue(verify_compact_evidence_bundle(compact_evidence_bundle(ITEMS))['valid'])
    def test_tamper_detected(self):
        b=compact_evidence_bundle(ITEMS); b['item_count']=2; self.assertFalse(verify_compact_evidence_bundle(b)['valid'])
    def test_report_claim_boundary(self): self.assertIn('JSON structural',evidence_reduction_report(compact_evidence_bundle(ITEMS))['claim_boundary'])
if __name__=='__main__': unittest.main()
