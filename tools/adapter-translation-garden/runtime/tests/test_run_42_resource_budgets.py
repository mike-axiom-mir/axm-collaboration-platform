from __future__ import annotations
import json,unittest
from pathlib import Path
from axm_translation_core import evaluate_resource_budget,evaluate_output_expansion
ROOT=Path(__file__).resolve().parents[1]
PROFILES=json.loads((ROOT/'assurance'/'MODULE_ASSURANCE_PROFILES.json').read_text(encoding='utf-8'))['profiles']
class Run42ResourceBudgetTests(unittest.TestCase):
    def test_within(self): self.assertEqual(evaluate_resource_budget({'bytes':10},{'bytes':10})['verdict'],'WITHIN_BUDGET')
    def test_exceeded(self): self.assertEqual(evaluate_resource_budget({'bytes':11},{'bytes':10})['verdict'],'REFUSE')
    def test_missing_usage(self): self.assertEqual(evaluate_resource_budget({}, {'bytes':10})['verdict'],'REFUSE')
    def test_invalid_limit(self): self.assertEqual(evaluate_resource_budget({'bytes':1},{'bytes':-1})['verdict'],'REFUSE')
    def test_not_measured(self): self.assertFalse(evaluate_resource_budget({'x':1},{'x':2})['measured'])
    def test_not_executed(self): self.assertFalse(evaluate_resource_budget({'x':1},{'x':2})['executed'])
    def test_expansion_within(self): self.assertEqual(evaluate_output_expansion(input_bytes=10,output_bytes=20,max_output_bytes=100,max_expansion_ratio=3)['verdict'],'WITHIN_BUDGET')
    def test_expansion_ratio_refuse(self): self.assertIn('max_expansion_ratio_exceeded',evaluate_output_expansion(input_bytes=10,output_bytes=40,max_output_bytes=100,max_expansion_ratio=3)['errors'])
    def test_output_size_refuse(self): self.assertIn('max_output_bytes_exceeded',evaluate_output_expansion(input_bytes=10,output_bytes=101,max_output_bytes=100,max_expansion_ratio=20)['errors'])
    def test_zero_input_bounded(self): self.assertEqual(evaluate_output_expansion(input_bytes=0,output_bytes=2,max_output_bytes=10,max_expansion_ratio=2)['verdict'],'WITHIN_BUDGET')
    def test_negative_refuse(self): self.assertEqual(evaluate_output_expansion(input_bytes=-1,output_bytes=0,max_output_bytes=1,max_expansion_ratio=1)['verdict'],'REFUSE')
    def test_100_profiles(self): self.assertEqual(len(PROFILES),100)
    def test_all_profiles_advisory(self): self.assertTrue(all(p['advisory_only'] for p in PROFILES.values()))
    def test_all_profiles_no_authority(self): self.assertTrue(all(not p['runtime']['network_access'] and not p['runtime']['native_writes'] and not p['runtime']['process_launch'] for p in PROFILES.values()))
    def test_shadow_profiles_locked(self): self.assertEqual({int(k) for k,p in PROFILES.items() if p['shadow_lock']},{43,46,48,66,68,70,74,80,94,100})
if __name__=='__main__': unittest.main()
