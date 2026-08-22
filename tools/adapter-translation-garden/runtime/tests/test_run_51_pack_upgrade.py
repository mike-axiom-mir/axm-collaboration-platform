from __future__ import annotations
import json,unittest,zipfile,hashlib
from pathlib import Path
from axm_translation_core import compare_pack_manifests,build_upgrade_plan,build_downgrade_plan,verify_payload_hashes
ROOT=Path(__file__).resolve().parents[1]; PACKS=sorted((ROOT/'selective_packs').glob('*.zip'))
def data(pack):
    with zipfile.ZipFile(pack) as z:
        root=z.namelist()[0].split('/')[0]; m=json.loads(z.read(root+'/PACK_MANIFEST.json')); u=json.loads(z.read(root+'/UPGRADE_PLAN.json')); files={n[len(root)+1:]:z.read(n) for n in z.namelist() if n.startswith(root+'/') and not n.endswith('/')}; return m,u,files
class Run51PackUpgradeTests(unittest.TestCase):
    def test_90_packs_match_current_revision(self):
        expected=json.loads((ROOT/'garden_manifest.json').read_text())['selective_pack_revision']; self.assertEqual(sum(data(p)[0]['pack_revision']==expected for p in PACKS),90)
    def test_all_upgrade_plans_reviewable(self): self.assertTrue(all(data(p)[1]['verdict']=='REVIEWABLE_COMPATIBLE_PACKAGE_REVISION' for p in PACKS))
    def test_all_previous_hashes_present(self): self.assertTrue(all(len(data(p)[0]['previous_pack_sha256'])==64 for p in PACKS))
    def test_all_module_code_unchanged(self): self.assertTrue(all(data(p)[1]['comparison']['module_code_unchanged'] for p in PACKS))
    def test_all_authority_unchanged(self): self.assertTrue(all(data(p)[1]['comparison']['authority_unchanged'] for p in PACKS))
    def test_no_automatic_install(self): self.assertTrue(all(data(p)[1]['automatic_install'] is False for p in PACKS))
    def test_payload_hashes_pass(self):
        for p in PACKS:
            with self.subTest(p=p.name):
                m,u,files=data(p); payload={k:v for k,v in files.items() if k in m['payload_files_sha256']}; self.assertEqual(verify_payload_hashes(payload,m['payload_files_sha256'])['verdict'],'PASS')
    def test_tamper_detected(self): self.assertEqual(verify_payload_hashes({'a':b'x'},{'a':hashlib.sha256(b'y').hexdigest()})['verdict'],'FAIL')
    def test_authority_change_holds(self): self.assertEqual(compare_pack_manifests({'module_id':'m','module_number':1,'authority_mode':'a','default_enabled':False,'files_sha256':{'module/implementation.py':'x'}},{'module_id':'m','module_number':1,'authority_mode':'b','default_enabled':False,'pack_revision':2,'payload_files_sha256':{'module/implementation.py':'x'}})['verdict'],'HOLD')
    def test_revision_not_forward_holds(self): self.assertEqual(compare_pack_manifests({'module_id':'m','module_number':1,'authority_mode':'a','default_enabled':False,'pack_revision':2,'files_sha256':{'module/implementation.py':'x'}},{'module_id':'m','module_number':1,'authority_mode':'a','default_enabled':False,'pack_revision':2,'payload_files_sha256':{'module/implementation.py':'x'}})['verdict'],'HOLD')
    def test_downgrade_review_only(self): self.assertEqual(build_downgrade_plan({'module_id':'m','authority_mode':'a','default_enabled':False},{'module_id':'m','authority_mode':'a','default_enabled':False},target_pack_sha256='x')['verdict'],'REVIEWABLE')
    def test_audit_counts(self):
        a=json.loads((ROOT/'SELECTIVE_PACK_AUDIT.json').read_text()); self.assertEqual(a['upgrade_plans_passed'],90); self.assertEqual(a['checksum_passed'],90)
if __name__=='__main__': unittest.main()
