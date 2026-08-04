import unittest
from axm_translation_core import normalize_host_profile,reference_host_requirements,evaluate_host_compatibility,verify_host_compatibility
class T(unittest.TestCase):
 def good(self): return {'os_family':'Windows','architecture':'x86_64','python_version':'3.11.2','free_space_mb':1000,'writable_staging':True,'standard_library_available':True,'probe_executed':True}
 def test_normalize_os(self): self.assertEqual(normalize_host_profile(self.good())['os_family'],'windows')
 def test_version(self): self.assertEqual(normalize_host_profile(self.good())['python_version'],[3,11,2])
 def test_requirements_offline(self): self.assertFalse(reference_host_requirements()['network_required'])
 def test_good_pass(self): self.assertEqual(evaluate_host_compatibility(self.good())['verdict'],'PASS')
 def test_old_python_hold(self):
  p=self.good(); p['python_version']='3.9'; self.assertEqual(evaluate_host_compatibility(p)['verdict'],'HOLD')
 def test_space_hold(self):
  p=self.good(); p['free_space_mb']=1; self.assertEqual(evaluate_host_compatibility(p)['verdict'],'HOLD')
 def test_unknown_probe(self): self.assertEqual(evaluate_host_compatibility({})['verdict'],'HOLD')
 def test_not_executed_requires_check(self):
  p=self.good(); p['probe_executed']=False; self.assertEqual(evaluate_host_compatibility(p)['verdict'],'HOST_CHECK_REQUIRED')
 def test_verify(self): self.assertEqual(verify_host_compatibility(evaluate_host_compatibility(self.good()))['verdict'],'PASS')
 def test_no_install(self): self.assertFalse(evaluate_host_compatibility(self.good())['automatic_install'])
if __name__=='__main__': unittest.main()
