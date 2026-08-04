from __future__ import annotations
import json
import unittest
from tools.module_loader import load_implementation

class SafetyBoundaryTests(unittest.TestCase):
    def _lease(self):
        m=load_implementation(82)
        return m.create_lease(granted_by='human:mike',operations=['preview'],target='module:012',scope={'record':'r1'},issued_at='2026-07-27T16:00:00Z',expires_at='2026-07-27T18:00:00Z',purpose='translation preview',revocation_id='rev-1')
    def test_082_exact_lease_allows(self):
        m=load_implementation(82); r=m.evaluate(self._lease(),{'operation':'preview','target':'module:012','scope':{'record':'r1'},'purpose':'translation preview'},at_time='2026-07-27T17:00:00Z'); self.assertTrue(r['allowed'])
    def test_082_expired_denies(self):
        m=load_implementation(82); r=m.evaluate(self._lease(),{'operation':'preview','target':'module:012','scope':{'record':'r1'},'purpose':'translation preview'},at_time='2026-07-27T19:00:00Z'); self.assertFalse(r['allowed'])
    def test_082_revoked_denies(self):
        m=load_implementation(82); r=m.evaluate(self._lease(),{'operation':'preview','target':'module:012','scope':{'record':'r1'},'purpose':'translation preview'},at_time='2026-07-27T17:00:00Z',revoked_ids=['rev-1']); self.assertFalse(r['allowed'])
    def test_082_inheritance_denies(self):
        m=load_implementation(82); r=m.evaluate(self._lease(),{'operation':'preview','target':'module:012','scope':{'record':'r1'},'purpose':'translation preview','inherited_from':'parent'},at_time='2026-07-27T17:00:00Z'); self.assertFalse(r['allowed'])
    def test_083_encoded_traversal_denies(self):
        m=load_implementation(83); r=m.evaluate_path('%2e%2e/secret',allowed_roots=['/safe'],platform='posix',resolved_path='/secret'); self.assertFalse(r['allowed'])
    def test_083_resolved_escape_denies(self):
        m=load_implementation(83); r=m.evaluate_path('link/file',allowed_roots=['/safe'],platform='posix',resolved_path='/outside/file'); self.assertFalse(r['allowed'])
    def test_083_confined_path_allows(self):
        m=load_implementation(83); r=m.evaluate_path('folder/file',allowed_roots=['/safe'],platform='posix',resolved_path='/safe/folder/file'); self.assertTrue(r['allowed'])
    def test_083_url_redirect_escape_denies(self):
        m=load_implementation(83); r=m.evaluate_url('https://example.org/a',allowed_schemes=['https'],allowed_hosts=['example.org'],redirects=['https://evil.org/x']); self.assertFalse(r['allowed'])
    def test_083_url_userinfo_denies(self):
        m=load_implementation(83); r=m.evaluate_url('https://user:pass@example.org/a',allowed_schemes=['https'],allowed_hosts=['example.org']); self.assertFalse(r['allowed'])
    def test_084_redacts_nested_secret(self):
        m=load_implementation(84); r=m.run({'auth':{'token':'secret-value'}}); self.assertNotIn('secret-value',json.dumps(r)); self.assertEqual(r['finding_count'],1)
    def test_084_personal_key_is_opt_in(self):
        m=load_implementation(84); r=m.run({'email':'a@example.org'},personal_keys=['email'],detect_patterns=[]); self.assertNotIn('a@example.org',json.dumps(r))
    def test_084_email_pattern_opt_in(self):
        m=load_implementation(84); r=m.run('contact a@example.org',detect_patterns=['email']); self.assertNotIn('a@example.org',r['redacted'])

if __name__=='__main__': unittest.main()
