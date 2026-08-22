import copy,unittest
from axm_translation_core import build_intake_dashboard,verify_intake_dashboard,render_intake_dashboard
T={'tests_run':10,'tests_passed':10,'failures':0}; A={'files_scanned':5,'issues':[],'shadow_implementations':[]}; P={'packs':90,'failed':[],'zip_integrity':'PASS'}
class X(unittest.TestCase):
 def green(self): return build_intake_dashboard(T,A,P,[])
 def test_green(self): self.assertEqual(self.green()['status'],'GREEN')
 def test_amber(self): self.assertEqual(build_intake_dashboard(T,A,P,[{'name':'host','state':'PENDING'}])['status'],'AMBER')
 def test_red_tests(self): self.assertEqual(build_intake_dashboard({'tests_run':1,'tests_passed':0,'failures':1},A,P,[])['status'],'RED')
 def test_red_authority(self): self.assertEqual(build_intake_dashboard(T,{'issues':[1]},P,[])['status'],'RED')
 def test_red_pack(self): self.assertEqual(build_intake_dashboard(T,A,{'packs':90,'failed':[1],'zip_integrity':'FAIL'},[])['status'],'RED')
 def test_limitation_amber(self): self.assertEqual(build_intake_dashboard(T,A,P,[],['host unknown'])['status'],'AMBER')
 def test_verify(self): self.assertEqual(verify_intake_dashboard(self.green())['verdict'],'PASS')
 def test_no_auto(self): self.assertFalse(self.green()['automatic_approval'])
 def test_render(self): self.assertIn('Tests: 10/10',render_intake_dashboard(self.green()))
 def test_tamper(self):
  d=self.green(); d['status']='RED'; self.assertEqual(verify_intake_dashboard(d)['verdict'],'HOLD')
if __name__=='__main__': unittest.main()
