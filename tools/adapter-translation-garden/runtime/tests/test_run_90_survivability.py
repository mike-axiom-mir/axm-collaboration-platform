import copy,unittest
from axm_translation_core import build_survivability_checkpoint,verify_survivability_checkpoint,survivability_action_report
PASS={'conflict':{'verdict':'PASS','conflicts':0},'drift':{'verdict':'PASS'},'availability':{'verdict':'PASS'},'freshness':{'verdict':'PASS'},'packs':{'verified_packs':90,'expected_packs':90,'failed_packs':[]}}
class SurvivabilityTests(unittest.TestCase):
    def checkpoint(self): return build_survivability_checkpoint(PASS['conflict'],PASS['drift'],PASS['availability'],PASS['freshness'],PASS['packs'])
    def test_ready(self): self.assertEqual(self.checkpoint()['decision'],'READY_FOR_SURVIVABILITY_REVIEW')
    def test_verify(self): self.assertEqual(verify_survivability_checkpoint(self.checkpoint())['verdict'],'PASS')
    def test_hold_conflict(self):
        c={'verdict':'PASS','conflicts':1}; self.assertIn('evidence_conflicts',build_survivability_checkpoint(c,PASS['drift'],PASS['availability'],PASS['freshness'],PASS['packs'])['holds'])
    def test_hold_packs(self):
        p={'verified_packs':89,'expected_packs':90,'failed_packs':[1]}; self.assertIn('selective_packs',build_survivability_checkpoint(PASS['conflict'],PASS['drift'],PASS['availability'],PASS['freshness'],p)['holds'])
    def test_tamper(self):
        c=self.checkpoint(); c['holds']=['x']; self.assertEqual(verify_survivability_checkpoint(c)['verdict'],'HOLD')
    def test_no_failover(self): self.assertFalse(self.checkpoint()['automatic_failover'])
    def test_report(self): self.assertIn('ready',survivability_action_report(self.checkpoint()).lower())
    def test_report_hold(self):
        c=self.checkpoint(); c['decision']='HOLD'; c['holds']=['x']; self.assertIn('hold',survivability_action_report(c).lower())
if __name__=='__main__': unittest.main()
