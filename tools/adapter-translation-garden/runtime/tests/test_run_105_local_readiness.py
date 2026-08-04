import copy,unittest
from axm_translation_core import build_local_intake_readiness,verify_local_intake_readiness,local_intake_action_report
P={'tests_pass':True,'authority_violations':0,'verified_packs':90,'expected_packs':90,'failed_packs':[]}; V={'verdict':'PASS'}; S={'verdict':'PASS','locked_count':10,'expected_locked_count':10}
class T(unittest.TestCase):
 def candidate(self): return build_local_intake_readiness(P,{'verdict':'HOST_CHECK_REQUIRED'},V,V,V,V,S)
 def ready(self): return build_local_intake_readiness(P,{'verdict':'PASS'},V,V,V,V,S)
 def test_candidate(self): self.assertEqual(self.candidate()['decision'],'READY_FOR_CONTROLLED_LOCAL_INTAKE_CANDIDATE')
 def test_ready(self): self.assertEqual(self.ready()['decision'],'READY_FOR_CONTROLLED_LOCAL_INTAKE')
 def test_hold_package(self): self.assertEqual(build_local_intake_readiness({**P,'tests_pass':False},{'verdict':'PASS'},V,V,V,V,S)['decision'],'HOLD')
 def test_hold_host(self): self.assertEqual(build_local_intake_readiness(P,{'verdict':'HOLD'},V,V,V,V,S)['decision'],'HOLD')
 def test_hold_order(self): self.assertIn('order',build_local_intake_readiness(P,{'verdict':'PASS'},{'verdict':'HOLD'},V,V,V,S)['holds'])
 def test_verify(self): self.assertEqual(verify_local_intake_readiness(self.candidate())['verdict'],'PASS')
 def test_no_full_install(self): self.assertFalse(self.candidate()['direct_full_install_ready'])
 def test_no_auto(self): self.assertFalse(self.candidate()['automatic_install'])
 def test_first_batch(self): self.assertEqual(len(self.candidate()['recommended_first_batch']),6)
 def test_report(self): self.assertIn('host check',local_intake_action_report(self.candidate()).lower())
if __name__=='__main__': unittest.main()
