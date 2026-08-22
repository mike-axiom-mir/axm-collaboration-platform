from __future__ import annotations
import json,unittest
from pathlib import Path
from axm_translation_core import compare_public_api,compare_module_baseline,summarize_baseline
ROOT=Path(__file__).resolve().parents[1]
BASE=json.loads((ROOT/'compatibility'/'API_BASELINE_RUN_45.json').read_text())
CUR=json.loads((ROOT/'ASSURANCE_INDEX.json').read_text())
class Run46CompatibilityTests(unittest.TestCase):
    def test_identical_api(self): self.assertEqual(compare_public_api([{'name':'x'}],[{'name':'x'}])['verdict'],'IDENTICAL')
    def test_additive_api(self): self.assertEqual(compare_public_api([{'name':'x'}],[{'name':'x'},{'name':'y'}])['verdict'],'ADDITIVE')
    def test_removed_breaks(self): self.assertEqual(compare_public_api([{'name':'x'}],[])['verdict'],'BREAKING')
    def test_changed_breaks(self): self.assertEqual(compare_public_api([{'name':'x','defaults':[]}],[{'name':'x','defaults':['1']}])['verdict'],'BREAKING')
    def test_no_execution(self): self.assertFalse(compare_public_api([],[])['executed'])
    def test_all_100_compared(self): self.assertEqual(summarize_baseline(BASE['entries'],CUR['entries'])['modules_compared'],100)
    def test_baseline_passes(self): self.assertEqual(summarize_baseline(BASE['entries'],CUR['entries'])['verdict'],'PASS')
    def test_no_incompatible_modules(self): self.assertEqual(summarize_baseline(BASE['entries'],CUR['entries'])['incompatible_modules'],[])
    def test_authority_change_refused(self):
        a=dict(BASE['entries'][0]); b=dict(a); b['authority_mode']='live'; self.assertEqual(compare_module_baseline(a,b)['verdict'],'BREAKING_OR_ESCALATED')
    def test_identity_change_refused(self):
        a=dict(BASE['entries'][0]); b=dict(a); b['id']='other'; self.assertEqual(compare_module_baseline(a,b)['verdict'],'BREAKING_OR_ESCALATED')
    def test_baseline_source_bound(self): self.assertEqual(BASE['source_sha256'],'b5c2a77acd863ded821735d4ecb43f499dbbe73c66457238888817b88fc86277')
    def test_module_apis_unchanged(self): self.assertTrue(all(x['api']['verdict']=='IDENTICAL' for x in summarize_baseline(BASE['entries'],CUR['entries'])['reports']))
if __name__=='__main__': unittest.main()
