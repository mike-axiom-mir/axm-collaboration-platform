from __future__ import annotations
import json,unittest
from pathlib import Path
from axm_translation_core import analyze_dependency_closure,compare_dependency_plans
ROOT=Path(__file__).resolve().parents[1]
MANIFESTS=[json.loads(p.read_text()) for p in sorted((ROOT/'modules').glob('*/module.json'))]
class Run54DependencyTests(unittest.TestCase):
    def test_real_module_passes(self): self.assertEqual(analyze_dependency_closure(MANIFESTS,[MANIFESTS[0]['id']])['verdict'],'PASS')
    def test_unknown_holds(self): self.assertEqual(analyze_dependency_closure(MANIFESTS,['missing'])['verdict'],'HOLD')
    def test_unknown_visible(self): self.assertEqual(analyze_dependency_closure(MANIFESTS,['missing'])['blockers']['missing'],['missing'])
    def test_shadow_holds(self):
        sid=next(m['id'] for m in MANIFESTS if m['authority_mode']=='shadow_only'); self.assertIn(sid,analyze_dependency_closure(MANIFESTS,[sid])['blockers']['shadow'])
    def test_authority_conflict(self):
        m={'id':'x','hard_dependencies':[],'authority_mode':'inspect_only','default_enabled':True,'implementation':{'network_access':False,'native_writes':False}}; self.assertIn('x',analyze_dependency_closure([m],['x'])['blockers']['authority_conflicts'])
    def test_network_conflict(self):
        m={'id':'x','hard_dependencies':[],'authority_mode':'inspect_only','default_enabled':False,'implementation':{'network_access':True,'native_writes':False}}; self.assertEqual(analyze_dependency_closure([m],['x'])['verdict'],'HOLD')
    def test_cycle_detected(self):
        a={'id':'a','hard_dependencies':['b'],'authority_mode':'inspect_only','default_enabled':False,'implementation':{'network_access':False,'native_writes':False}}; b={'id':'b','hard_dependencies':['a'],'authority_mode':'inspect_only','default_enabled':False,'implementation':{'network_access':False,'native_writes':False}}; self.assertTrue(analyze_dependency_closure([a,b],['a'])['blockers']['cycles'])
    def test_topological_dependency_first(self):
        a={'id':'a','hard_dependencies':['b'],'authority_mode':'inspect_only','default_enabled':False,'implementation':{'network_access':False,'native_writes':False}}; b={'id':'b','hard_dependencies':[],'authority_mode':'inspect_only','default_enabled':False,'implementation':{'network_access':False,'native_writes':False}}; self.assertEqual(analyze_dependency_closure([a,b],['a'])['closure_order'],['b','a'])
    def test_plan_identical(self): self.assertEqual(compare_dependency_plans({'closure_order':['a']},{'closure_order':['a']})['verdict'],'IDENTICAL')
    def test_plan_review(self): self.assertEqual(compare_dependency_plans({'closure_order':['a']},{'closure_order':['a','b']})['verdict'],'REVIEW')
    def test_no_install(self): self.assertFalse(analyze_dependency_closure(MANIFESTS,[MANIFESTS[0]['id']])['automatic_install'])
    def test_no_execution(self): self.assertFalse(analyze_dependency_closure(MANIFESTS,[MANIFESTS[0]['id']])['executed'])
if __name__=='__main__': unittest.main()
