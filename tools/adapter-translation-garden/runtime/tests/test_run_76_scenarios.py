import copy,unittest
from axm_translation_core import build_scenario_matrix,scenario_coverage_report,verify_scenario_matrix
class ScenarioTests(unittest.TestCase):
    def matrix(self): return build_scenario_matrix({'format':['json','xml'],'locale':['en','nl'],'offline':[True,False]},max_cases=20)
    def test_bounded(self): self.assertLessEqual(len(self.matrix()['scenarios']),20)
    def test_deterministic(self): self.assertEqual(self.matrix()['matrix_sha256'],self.matrix()['matrix_sha256'])
    def test_verifies(self): self.assertEqual(verify_scenario_matrix(self.matrix())['verdict'],'PASS')
    def test_tamper_fails(self):
        m=copy.deepcopy(self.matrix()); m['scenarios'][0]['values']['format']='bad'; self.assertEqual(verify_scenario_matrix(m)['verdict'],'HOLD')
    def test_dimension_values_covered(self): self.assertTrue(scenario_coverage_report(self.matrix())['complete_dimension_value_coverage'])
    def test_constraints_reject(self):
        m=build_scenario_matrix({'a':[1,2],'b':[1,2]},[{'when':{'a':2},'forbid':{'b':2}}]); self.assertGreater(m['rejected_by_constraints'],0)
    def test_truncation_visible(self): self.assertTrue(build_scenario_matrix({'a':list(range(6)),'b':list(range(6))},max_cases=2)['truncated'])
    def test_invalid_max(self):
        with self.assertRaises(ValueError): build_scenario_matrix({'a':[1]},max_cases=0)
    def test_no_execute(self): self.assertFalse(self.matrix()['executed'])
if __name__=='__main__': unittest.main()
