import unittest
from axm_translation_core import fixture_coverage_report, mutation_adequacy_report, fixture_adequacy_gate
class FixtureTests(unittest.TestCase):
    def test_full_coverage(self): self.assertEqual(fixture_coverage_report([{'id':'success'},{'id':'refusal','critical':True}],[{'covers':['success','refusal']}])['verdict'],'PASS')
    def test_critical_missing_holds(self): self.assertEqual(fixture_coverage_report([{'id':'refusal','critical':True}],[])['verdict'],'HOLD')
    def test_noncritical_gap_visible(self): self.assertIn('edge',fixture_coverage_report([{'id':'edge'}],[])['missing'])
    def test_empty_requirements_hold(self): self.assertEqual(fixture_coverage_report([],[])['verdict'],'HOLD')
    def test_all_mutants_killed(self): self.assertEqual(mutation_adequacy_report(['m1'],[{'mutation_id':'m1','outcome':'KILLED'}])['verdict'],'PASS')
    def test_survived_mutant_holds(self): self.assertIn('m1',mutation_adequacy_report(['m1'],[{'mutation_id':'m1','outcome':'SURVIVED'}])['survived'])
    def test_not_run_holds(self): self.assertIn('m1',mutation_adequacy_report(['m1'],[])['not_run'])
    def test_combined_gate(self):
        c=fixture_coverage_report([{'id':'r','critical':True}],[{'covers':['r']}]); m=mutation_adequacy_report(['m'],[{'mutation_id':'m','outcome':'KILLED'}]); self.assertEqual(fixture_adequacy_gate(c,m)['decision'],'REVIEWABLE')
if __name__=='__main__': unittest.main()
