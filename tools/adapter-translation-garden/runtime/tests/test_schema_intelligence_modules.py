from __future__ import annotations
import unittest
from tools.module_loader import load_implementation

class SchemaIntelligenceTests(unittest.TestCase):
    def test_021_definitions_to_defs(self):
        m=load_implementation(21); r=m.translate({'$schema':'http://json-schema.org/draft-07/schema#','definitions':{'x':{'type':'string'}}},target_dialect='2020-12'); self.assertIn('$defs',r['translated']); self.assertTrue(r['ok'])
    def test_021_unsupported_keyword_visible(self):
        m=load_implementation(21); r=m.translate({'$schema':'https://json-schema.org/draft/2020-12/schema','unevaluatedProperties':False},target_dialect='draft7'); self.assertFalse(r['ok']); self.assertIn('x-axm-unsupported-keywords',r['translated'])
    def test_021_bundle_no_network(self):
        m=load_implementation(21); r=m.bundle({'$ref':'axm://x'},{'axm://x':{'type':'string'}}); self.assertTrue(r['ok']); self.assertFalse(r['network_fetch_performed'])
    def test_021_bundle_unresolved(self):
        m=load_implementation(21); r=m.bundle({'$ref':'https://example.org/x'},{}); self.assertFalse(r['ok'])
    def test_027_rows_inference(self):
        m=load_implementation(27); r=m.run([{'id':1,'active':True},{'id':2,'active':False}]); self.assertEqual(r['properties']['id']['candidate_type'],'integer'); self.assertEqual(r['properties']['active']['candidate_type'],'boolean')
    def test_027_leading_zero_stays_string(self):
        m=load_implementation(27); r=m.run([{'code':'001'},{'code':'002'}]); self.assertEqual(r['properties']['code']['candidate_type'],'string')
    def test_027_malformed_csv_row(self):
        m=load_implementation(27); r=m.run('a,b\n1\n',format='csv'); self.assertEqual(len(r['malformed_rows']),1)
    def test_027_formula_not_evaluated(self):
        m=load_implementation(27); r=m.run([{'x':'=1+1'}]); self.assertTrue(r['properties']['x']['formula_present_not_evaluated']); self.assertFalse(r['formulas_evaluated'])
    def test_028_widened_type(self):
        m=load_implementation(28); r=m.run({'properties':{'x':{'type':'integer'}}},{'properties':{'x':{'type':['integer','null']}}}); self.assertEqual(r['verdict'],'NON_BREAKING_CANDIDATE')
    def test_028_removed_is_breaking(self):
        m=load_implementation(28); r=m.run({'properties':{'x':{'type':'integer'}}},{'properties':{}}); self.assertEqual(r['verdict'],'POTENTIALLY_BREAKING')
    def test_028_explicit_rename(self):
        m=load_implementation(28); r=m.run({'properties':{'old':{'type':'string'}}},{'properties':{'new':{'type':'string'}}},rename_hints={'old':'new'}); self.assertTrue(any(c['kind']=='renamed' for c in r['changes']))
    def test_029_matrix_pass_and_fail(self):
        m=load_implementation(29)
        producers={'1.0':lambda x:{'x':x},'2.0':lambda x:{'x':x,'new':1}}
        consumers={'1.0':lambda p:set(p)<={'x'},'2.0':lambda p:'x' in p}
        r=m.run(producers,consumers,[{'name':'one','value':1}]); self.assertEqual(r['verdict'],'FAIL'); self.assertTrue(any(not c['passed'] for c in r['cells']))
    def test_029_relation_labels(self):
        m=load_implementation(29); r=m.run({'1.0':lambda x:{'x':x}},{'2.0':lambda p:True},[{'value':1}]); self.assertEqual(r['cells'][0]['relation'],'backward_compatibility')
    def test_029_consumer_mutation_fails(self):
        m=load_implementation(29)
        def consumer(p): p['y']=2; return True
        r=m.run({'1.0':lambda x:{'x':x}},{'1.0':consumer},[{'value':1}]); self.assertFalse(r['cells'][0]['passed'])

if __name__=='__main__': unittest.main()
