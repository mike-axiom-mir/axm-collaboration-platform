from __future__ import annotations
import unittest
from axm_translation_core import purpose_bound_selection,verify_minimization,compose_purpose_chain
class Run52MinimizationTests(unittest.TestCase):
    def test_select_required(self): self.assertEqual(purpose_bound_selection({'a':1,'b':2},purpose='x',required_fields=['a'])['selected'],{'a':1})
    def test_drop_extra(self): self.assertEqual(purpose_bound_selection({'a':1,'b':2},purpose='x',required_fields=['a'])['dropped_fields'],['b'])
    def test_missing_refuses(self): self.assertEqual(purpose_bound_selection({},purpose='x',required_fields=['a'])['verdict'],'REFUSE')
    def test_not_consented_refuses(self): self.assertEqual(purpose_bound_selection({'a':1},purpose='x',required_fields=['a'],consented_fields=['b'])['verdict'],'REFUSE')
    def test_optional_selected(self): self.assertEqual(purpose_bound_selection({'a':1,'b':2},purpose='x',required_fields=['a'],optional_fields=['b'])['output_field_count'],2)
    def test_verify_pass(self): self.assertEqual(verify_minimization(purpose_bound_selection({'a':1},purpose='x',required_fields=['a']))['verdict'],'PASS')
    def test_max_fields(self): self.assertEqual(verify_minimization(purpose_bound_selection({'a':1,'b':2},purpose='x',required_fields=['a','b']),max_fields=1)['verdict'],'FAIL')
    def test_chain_pass(self): self.assertEqual(compose_purpose_chain([purpose_bound_selection({'a':1},purpose='x',required_fields=['a'])])['verdict'],'PASS')
    def test_chain_failure(self): self.assertEqual(compose_purpose_chain([purpose_bound_selection({},purpose='x',required_fields=['a'])])['verdict'],'FAIL')
    def test_no_execution(self): self.assertFalse(purpose_bound_selection({'a':1},purpose='x',required_fields=['a'])['executed'])
    def test_deduplicates_fields(self): self.assertEqual(purpose_bound_selection({'a':1},purpose='x',required_fields=['a','a'])['selected_fields'],['a'])
if __name__=='__main__': unittest.main()
