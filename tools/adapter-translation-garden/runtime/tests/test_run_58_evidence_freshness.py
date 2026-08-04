import unittest
from axm_translation_core import classify_evidence_freshness, aggregate_evidence_freshness, expiry_action_plan
class FreshnessTests(unittest.TestCase):
    def test_fresh(self): self.assertEqual(classify_evidence_freshness({'evidence_id':'e','observed_at':90},100,20)['status'],'FRESH')
    def test_stale(self): self.assertEqual(classify_evidence_freshness({'evidence_id':'e','observed_at':70},100,20)['status'],'STALE')
    def test_expired(self): self.assertEqual(classify_evidence_freshness({'evidence_id':'e','observed_at':90,'expires_at':100},100,20)['status'],'EXPIRED')
    def test_superseded(self): self.assertEqual(classify_evidence_freshness({'evidence_id':'e','observed_at':90,'superseded_by':'e2'},100,20)['status'],'SUPERSEDED')
    def test_future_timestamp(self): self.assertEqual(classify_evidence_freshness({'evidence_id':'e','observed_at':101},100,20)['status'],'FUTURE_TIMESTAMP')
    def test_all_fresh_bundle_passes(self): self.assertEqual(aggregate_evidence_freshness([{'evidence_id':'e','observed_at':90}],100,20)['verdict'],'PASS')
    def test_empty_bundle_holds(self): self.assertEqual(aggregate_evidence_freshness([],100,20)['verdict'],'HOLD')
    def test_action_plan_blocks_nonfresh(self): self.assertTrue(expiry_action_plan(aggregate_evidence_freshness([{'evidence_id':'e','observed_at':0}],100,20))['blocks_release'])
if __name__=='__main__': unittest.main()
