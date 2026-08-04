import copy,unittest
from axm_translation_core import build_intake_session_bundle,append_intake_session_event,close_intake_session,verify_intake_session_bundle
class T(unittest.TestCase):
 def start(self): return build_intake_session_bundle('s1',['m2','m1'],[{'ref':'x'}],100)
 def test_start(self): self.assertEqual(len(self.start()['events']),1)
 def test_sorted(self): self.assertEqual(self.start()['events'][0]['payload']['selected_modules'],['m1','m2'])
 def test_append(self): self.assertEqual(len(append_intake_session_event(self.start(),'REVIEWED',{'ok':True})['events']),2)
 def test_chain(self):
  b=append_intake_session_event(self.start(),'REVIEWED',{}); self.assertEqual(b['events'][1]['previous_sha256'],b['events'][0]['event_sha256'])
 def test_close(self): self.assertTrue(close_intake_session(self.start(),'ACCEPT',True)['closed'])
 def test_verify(self): self.assertEqual(verify_intake_session_bundle(self.start())['verdict'],'PASS')
 def test_verify_closed(self): self.assertEqual(verify_intake_session_bundle(close_intake_session(self.start(),'HOLD',False))['verdict'],'PASS')
 def test_no_decision(self): self.assertFalse(self.start()['automatic_decision'])
 def test_no_action(self): self.assertFalse(self.start()['automatic_action'])
 def test_tamper(self):
  b=self.start(); b['events'][0]['payload']['created_at']=101; self.assertEqual(verify_intake_session_bundle(b)['verdict'],'HOLD')
if __name__=='__main__': unittest.main()
