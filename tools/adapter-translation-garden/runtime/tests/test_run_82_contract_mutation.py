import copy,unittest
from axm_translation_core import generate_contract_mutations,mutation_coverage_report,contract_mutation_gate
C={'type':'object','properties':{'a':{'type':'string'},'b':{'type':'number'}},'required':['a']}
class MutationTests(unittest.TestCase):
    def ms(self): return generate_contract_mutations(C)
    def test_has_mutations(self): self.assertGreater(len(self.ms()['mutations']),3)
    def test_deterministic(self): self.assertEqual(self.ms()['set_sha256'],self.ms()['set_sha256'])
    def test_coverage(self): self.assertTrue(mutation_coverage_report(self.ms())['complete'])
    def test_gate(self): self.assertEqual(contract_mutation_gate(self.ms(),mutation_coverage_report(self.ms()))['decision'],'REVIEWABLE')
    def test_bound(self): self.assertTrue(generate_contract_mutations(C,max_cases=1)['truncated'])
    def test_no_executable(self): self.assertFalse(self.ms()['executable_payloads_generated'])
    def test_missing_kind_holds(self): self.assertEqual(contract_mutation_gate(self.ms(),mutation_coverage_report(self.ms(),['impossible']))['decision'],'HOLD')
    def test_tamper(self):
        m=copy.deepcopy(self.ms()); m['mutations'][0]['kind']='tamper'; self.assertEqual(contract_mutation_gate(m,mutation_coverage_report(m))['decision'],'HOLD')
    def test_invalid_bound(self):
        with self.assertRaises(ValueError): generate_contract_mutations(C,max_cases=0)
if __name__=='__main__': unittest.main()
