import copy,unittest
from axm_translation_core import classify_checkpoint_damage,build_damage_triage_plan,verify_damage_report
E=[{'path':'a','sha256':'1','required':True},{'path':'b','sha256':'2','required':False}]; O=[{'path':'a','sha256':'x'},{'path':'c','sha256':'3'}]
class DamageTests(unittest.TestCase):
    def report(self): return classify_checkpoint_damage(E,O)
    def test_critical(self): self.assertEqual(self.report()['critical_paths'],['a'])
    def test_warnings(self): self.assertCountEqual(self.report()['warning_paths'],['b','c'])
    def test_plan_hold(self): self.assertEqual(build_damage_triage_plan(self.report())['decision'],'HOLD_FOR_RECOVERY_REVIEW')
    def test_verify(self): self.assertEqual(verify_damage_report(self.report(),build_damage_triage_plan(self.report()))['verdict'],'PASS')
    def test_no_repair(self): self.assertFalse(build_damage_triage_plan(self.report())['repair_executed'])
    def test_no_delete(self): self.assertFalse(build_damage_triage_plan(self.report())['delete_executed'])
    def test_tamper(self):
        r=self.report(); r['critical_paths']=[]; self.assertEqual(verify_damage_report(r,build_damage_triage_plan(r))['verdict'],'HOLD')
    def test_intact(self): self.assertEqual(classify_checkpoint_damage([{'path':'a','sha256':'1'}],[{'path':'a','sha256':'1'}])['intact_count'],1)
if __name__=='__main__': unittest.main()
