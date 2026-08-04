import unittest
from axm_translation_core import build_pack_recovery_manifest, verify_pack_recovery_manifest, select_pack_recovery_candidate
H='a'*64; J='b'*64
class PackRecoveryTests(unittest.TestCase):
    def manifest(self): return build_pack_recovery_manifest('m',H,3,J,[{'pack_sha256':J,'pack_revision':2,'verified':True,'compatible':True}],['module/module.json'])
    def test_manifest_verifies(self): self.assertTrue(verify_pack_recovery_manifest(self.manifest())['valid'])
    def test_candidate_visible(self): self.assertEqual(verify_pack_recovery_manifest(self.manifest())['reviewable_candidates'],1)
    def test_selects_latest_compatible(self): self.assertEqual(select_pack_recovery_candidate(self.manifest())['candidate']['pack_revision'],2)
    def test_unverified_not_selected(self):
        m=build_pack_recovery_manifest('m',H,3,J,[{'pack_sha256':J,'pack_revision':2,'verified':False,'compatible':True}],[]); self.assertEqual(select_pack_recovery_candidate(m)['decision'],'HOLD')
    def test_incompatible_not_selected(self):
        m=build_pack_recovery_manifest('m',H,3,J,[{'pack_sha256':J,'pack_revision':2,'verified':True,'compatible':False}],[]); self.assertEqual(select_pack_recovery_candidate(m)['decision'],'HOLD')
    def test_tamper_detected(self):
        m=self.manifest(); m['pack_revision']=4; self.assertFalse(verify_pack_recovery_manifest(m)['valid'])
    def test_revision_requires_previous_hash(self):
        m=build_pack_recovery_manifest('m',H,3,None,[{'pack_sha256':J,'pack_revision':2,'verified':True,'compatible':True}],[]); self.assertFalse(verify_pack_recovery_manifest(m)['valid'])
    def test_never_auto_restores(self): self.assertFalse(select_pack_recovery_candidate(self.manifest())['automatic_restore'])
if __name__=='__main__': unittest.main()
