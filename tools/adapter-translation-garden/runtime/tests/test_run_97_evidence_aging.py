import copy,unittest
from axm_translation_core import simulate_evidence_aging,evidence_aging_gate,verify_evidence_aging_simulation
R=[{'evidence_id':'a','observed_at':100,'max_age_seconds':50},{'evidence_id':'b','observed_at':100,'expires_at':180,'required':False}]
class T(unittest.TestCase):
 def sim(self): return simulate_evidence_aging(R,120,[0,40,70])
 def test_snapshots(self): self.assertEqual(len(self.sim()['snapshots']),3)
 def test_fresh(self): self.assertEqual(self.sim()['snapshots'][0]['records'][0]['state'],'FRESH')
 def test_stale(self): self.assertEqual(self.sim()['snapshots'][1]['records'][0]['state'],'STALE')
 def test_expired(self): self.assertEqual(self.sim()['snapshots'][2]['records'][1]['state'],'EXPIRED')
 def test_gate_hold(self): self.assertEqual(evidence_aging_gate(self.sim())['verdict'],'HOLD')
 def test_fresh_gate(self): self.assertEqual(evidence_aging_gate(simulate_evidence_aging(R[:1],120,[0]))['verdict'],'PASS')
 def test_no_clock(self): self.assertFalse(self.sim()['clock_read'])
 def test_no_mutation(self): self.assertFalse(self.sim()['records_mutated'])
 def test_verify(self): self.assertEqual(verify_evidence_aging_simulation(self.sim())['verdict'],'PASS')
 def test_tamper(self):
  s=self.sim(); s['snapshots'][0]['required_holds']=['x']; self.assertEqual(verify_evidence_aging_simulation(s)['verdict'],'HOLD')
if __name__=='__main__': unittest.main()
