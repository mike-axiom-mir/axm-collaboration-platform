import unittest
from axm_translation_core import compare_fixture_contracts,build_fixture_evolution_plan,verify_fixture_evolution_plan
B={'properties':{'a':{'type':'string'},'b':{'type':'integer'}},'required':['a']}; SAFE={'properties':{'a':{'type':'string'},'b':{'type':'integer'},'c':{'type':'string'}},'required':['a']}; BREAK={'properties':{'a':{'type':'integer'}},'required':['a']}
class FixtureTests(unittest.TestCase):
    def test_safe(self): self.assertEqual(compare_fixture_contracts(B,SAFE)['breaking_changes'],[])
    def test_breaking(self): self.assertTrue(compare_fixture_contracts(B,BREAK)['breaking_changes'])
    def test_safe_plan(self): self.assertEqual(build_fixture_evolution_plan(compare_fixture_contracts(B,SAFE),[{'fixture_id':'f'}])['compatibility'],'REVIEWABLE_COMPATIBLE')
    def test_break_plan(self): self.assertEqual(build_fixture_evolution_plan(compare_fixture_contracts(B,BREAK),[{'fixture_id':'f'}])['compatibility'],'BREAKING')
    def test_verify_safe(self):
        r=compare_fixture_contracts(B,SAFE); self.assertEqual(verify_fixture_evolution_plan(r,build_fixture_evolution_plan(r,[{'fixture_id':'f'}]))['verdict'],'PASS')
    def test_no_migration(self): self.assertFalse(build_fixture_evolution_plan(compare_fixture_contracts(B,SAFE),[])['migration_executed'])
    def test_no_rewrite(self): self.assertFalse(build_fixture_evolution_plan(compare_fixture_contracts(B,SAFE),[])['source_rewrite'])
    def test_type_change(self): self.assertEqual(compare_fixture_contracts(B,BREAK)['changes'][0]['kind'],'TYPE_CHANGED')
if __name__=='__main__': unittest.main()
