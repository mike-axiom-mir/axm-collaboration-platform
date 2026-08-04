from __future__ import annotations
import copy
import unittest
from tools.module_loader import load_implementation

class Run2630Tests(unittest.TestCase):
    def test_022_import_operation(self):
        m=load_implementation(22); r=m.run({'openapi':'3.1.0','paths':{'/x':{'get':{'operationId':'getX','responses':{'200':{}}}}}}); self.assertEqual(r['operations'][0]['operation_id'],'getX')
    def test_022_security_not_authority(self):
        m=load_implementation(22); r=m.run({'openapi':'3.0.0','security':[{'key':[]}],'paths':{'/x':{'get':{}}}}); self.assertFalse(r['authority_granted']); self.assertEqual(r['operations'][0]['declared_security'],[{'key':[]}])
    def test_022_external_ref_visible(self):
        m=load_implementation(22); r=m.run({'openapi':'3.0.0','paths':{'/x':{'get':{'responses':{'200':{'$ref':'https://x/schema'}}}}}}); self.assertEqual(len(r['external_references_unresolved']),1)
    def test_022_duplicate_refused_partial(self):
        m=load_implementation(22); r=m.run({'openapi':'3.0.0','paths':{'/a':{'get':{'operationId':'x'}},'/b':{'post':{'operationId':'x'}}}}); self.assertEqual(r['verdict'],'PARTIAL')

    def test_023_asyncapi2(self):
        m=load_implementation(23); r=m.run({'asyncapi':'2.6.0','channels':{'a':{'publish':{'message':{'payload':{'type':'string'}}}}}}); self.assertEqual(r['operations'][0]['channel'],'a')
    def test_023_asyncapi3(self):
        m=load_implementation(23); r=m.run({'asyncapi':'3.0.0','channels':{'c':{}},'operations':{'send':{'action':'send','channel':{'$ref':'#/channels/c'}}}}); self.assertEqual(r['operations'][0]['channel'],'c')
    def test_023_no_connection(self):
        m=load_implementation(23); r=m.run({'asyncapi':'2.0.0','channels':{}}); self.assertFalse(r['connected'])
    def test_023_wrong_version(self):
        m=load_implementation(23); r=m.run({'asyncapi':'1.0.0'}); self.assertEqual(r['verdict'],'REFUSE')

    def test_024_unknown_preserved(self):
        m=load_implementation(24); data=bytes([0x08,0x96,0x01,0x12,0x03])+b'abc'; r=m.run(data,known_field_numbers=[1]); self.assertEqual(r['unknown_count'],1)
    def test_024_exact_reassembly(self):
        m=load_implementation(24); data=bytes([0x08,0x01,0x15,1,2,3,4]); report=m.run(data,known_field_numbers=[1]); self.assertEqual(m.reassemble(report['segments'])['data'],data)
    def test_024_truncated(self):
        m=load_implementation(24); r=m.run(bytes([0x12,0x05,0x01]),known_field_numbers=[]); self.assertEqual(r['verdict'],'REFUSE')
    def test_024_groups_refused(self):
        m=load_implementation(24); r=m.run(bytes([0x0b]),known_field_numbers=[]); self.assertIn('group',r['reason'])

    def test_025_exact_and_default(self):
        m=load_implementation(25); w={'type':'record','fields':[{'name':'a','type':'int'}]}; rd={'type':'record','fields':[{'name':'a','type':'long'},{'name':'b','type':'string','default':'x'}]}; r=m.run(w,rd,record={'a':1}); self.assertEqual(r['record'],{'a':1,'b':'x'})
    def test_025_alias(self):
        m=load_implementation(25); w={'type':'record','fields':[{'name':'old','type':'string'}]}; rd={'type':'record','fields':[{'name':'new','aliases':['old'],'type':'string'}]}; self.assertEqual(m.run(w,rd,record={'old':'v'})['record']['new'],'v')
    def test_025_missing_required(self):
        m=load_implementation(25); w={'type':'record','fields':[]}; rd={'type':'record','fields':[{'name':'x','type':'string'}]}; self.assertEqual(m.run(w,rd)['verdict'],'REFUSE')
    def test_025_incompatible(self):
        m=load_implementation(25); w={'type':'record','fields':[{'name':'x','type':'string'}]}; rd={'type':'record','fields':[{'name':'x','type':'int'}]}; self.assertTrue(m.run(w,rd)['errors'])

    def test_026_namespace_and_attribute(self):
        m=load_implementation(26); r=m.run('<r xmlns="u" a="1"><c>v</c></r>'); self.assertEqual(r['tree']['tag'],'{u}r'); self.assertEqual(r['tree']['attributes']['a'],'1')
    def test_026_mixed_content(self):
        m=load_implementation(26); r=m.run('<r>before<c/>after</r>'); self.assertEqual(r['tree']['children'][0]['tail'],'after')
    def test_026_xsd_inventory(self):
        m=load_implementation(26); x='<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="a" type="xs:string"/></xs:schema>'; self.assertEqual(m.run('<a/>',xsd_text=x)['xsd_inventory']['declarations'][0]['name'],'a')
    def test_026_doctype_refused(self):
        m=load_implementation(26); self.assertEqual(m.run('<!DOCTYPE x><x/>')['verdict'],'REFUSE')

    def test_041_extract_world(self):
        m=load_implementation(41); r=m.run('world demo { export run: func(x: string) -> string; }'); self.assertEqual(r['contracts'][0]['name'],'demo')
    def test_041_comment_ignored(self):
        m=load_implementation(41); r=m.run('// world fake {}\ninterface real { f: func(); }'); self.assertEqual(r['contracts'][0]['name'],'real')
    def test_041_unbalanced(self):
        m=load_implementation(41); self.assertEqual(m.run('world x { export y: func();')['verdict'],'REFUSE')
    def test_041_no_compile(self):
        m=load_implementation(41); r=m.run('world x {}',target_language='python'); self.assertFalse(r['compiled']); self.assertFalse(r['binding_descriptor']['generated'])

    def test_042_plan(self):
        m=load_implementation(42); r=m.run({'id':'c','imports':[{'name':'clock','capability':'time'}]},host_capabilities={'clock':{'kind':'host'}},grants=['time'],limits={'fuel':10}); self.assertEqual(r['verdict'],'PLAN_READY')
    def test_042_missing_grant(self):
        m=load_implementation(42); r=m.run({'imports':[{'name':'fs','capability':'filesystem'}]},host_capabilities={'fs':{}},grants=[],limits={'fuel':1}); self.assertEqual(r['verdict'],'REFUSE')
    def test_042_bad_limit(self):
        m=load_implementation(42); r=m.run({'imports':[]},host_capabilities={},grants=[],limits={'fuel':0}); self.assertTrue(r['errors'])
    def test_042_no_execution(self):
        m=load_implementation(42); r=m.run({'imports':[]},host_capabilities={},grants=[],limits={}); self.assertFalse(r['instantiated']); self.assertFalse(r['executed'])

    def test_044_plan_exact_argv(self):
        m=load_implementation(44); r=m.run('tool',['--x','1'],{'id':1,'method':'go'},executable_allowlist=['tool'],cwd='/tmp/a',cwd_root='/tmp',environment={'A':'1','B':'2'},allowed_environment_keys=['A']); self.assertEqual(r['plan']['argv'],['tool','--x','1']); self.assertEqual(r['plan']['environment'],{'A':'1'})
    def test_044_not_allowlisted(self):
        m=load_implementation(44); r=m.run('bad',[],{'method':'x'},executable_allowlist=[],cwd='/tmp',cwd_root='/tmp'); self.assertEqual(r['verdict'],'REFUSE')
    def test_044_cwd_confined(self):
        m=load_implementation(44); r=m.run('t',[],{'method':'x'},executable_allowlist=['t'],cwd='/etc',cwd_root='/tmp'); self.assertIn('cwd_outside_root',r['errors'])
    def test_044_never_spawns(self):
        m=load_implementation(44); r=m.run('t',[],{'method':'x'},executable_allowlist=['t'],cwd='/tmp',cwd_root='/tmp'); self.assertFalse(r['executed']); self.assertFalse(r['plan']['spawned'])

    def test_045_compile(self):
        m=load_implementation(45); spec={'executable':'t','arguments':[{'name':'input','style':'positional','position':0,'required':True},{'name':'n','type':'integer','flag':'--count'}]}; self.assertEqual(m.run(spec,{'input':'a','n':2})['argv'],['t','a','--count','2'])
    def test_045_flag(self):
        m=load_implementation(45); spec={'executable':'t','arguments':[{'name':'verbose','type':'boolean','style':'flag','flag':'-v'}]}; self.assertEqual(m.run(spec,{'verbose':True})['argv'],['t','-v'])
    def test_045_unknown_refused(self):
        m=load_implementation(45); self.assertEqual(m.run({'executable':'t','arguments':[]},{'x':1})['verdict'],'REFUSE')
    def test_045_no_shell(self):
        m=load_implementation(45); r=m.run({'executable':'t','arguments':[]},{}); self.assertFalse(r['shell']); self.assertFalse(r['executed'])

    def test_047_maps_components(self):
        m=load_implementation(47); scene={'entities':[{'id':'1','components':[{'type':'Transform','data':{'x':1}}]}]}; r=m.run(scene,component_map={'Transform':'Node3D'},target_capabilities=['Node3D']); self.assertEqual(r['target_scene']['entities'][0]['components'][0]['type'],'Node3D')
    def test_047_sidecar_unknown(self):
        m=load_implementation(47); r=m.run({'entities':[{'id':'1','components':[{'type':'Magic'}]}]},component_map={},target_capabilities=[]); self.assertEqual(len(r['sidecars']),1)
    def test_047_missing_parent(self):
        m=load_implementation(47); r=m.run({'entities':[{'id':'1','parent_id':'x'}]},component_map={},target_capabilities=[]); self.assertTrue(r['errors'])
    def test_047_no_engine(self):
        m=load_implementation(47); r=m.run({'entities':[]},component_map={},target_capabilities=[]); self.assertFalse(r['engine_loaded']); self.assertFalse(r['written'])

    def test_049_recipe_plan(self):
        m=load_implementation(49); r=m.run({'id':'b','entrypoint':'fixed','capabilities':['mesh']},{'id':'r','required_capabilities':['mesh'],'operations':[{'operation':'add','parameters':{'x':1}}]},approved_entrypoints=['fixed'],approved_operations=['add']); self.assertEqual(r['verdict'],'PLAN_READY')
    def test_049_entrypoint_refused(self):
        m=load_implementation(49); r=m.run({'entrypoint':'bad'},{'operations':[]},approved_entrypoints=['good'],approved_operations=[]); self.assertEqual(r['verdict'],'REFUSE')
    def test_049_operation_refused(self):
        m=load_implementation(49); r=m.run({'entrypoint':'e'},{'operations':[{'operation':'script'}]},approved_entrypoints=['e'],approved_operations=[]); self.assertTrue(r['errors'])
    def test_049_no_launch(self):
        m=load_implementation(49); r=m.run({'entrypoint':'e'},{'operations':[]},approved_entrypoints=['e'],approved_operations=[]); self.assertFalse(r['host_launched']); self.assertFalse(r['files_written'])

    def test_050_headless_selected(self):
        m=load_implementation(50); r=m.run({'required_capabilities':['x']},headless={'capabilities':['x'],'authority':'decision_only'},gui={'capabilities':['x'],'authority':'decision_only','human_visible':True}); self.assertEqual(r['selected']['mode'],'headless')
    def test_050_visible_selects_gui(self):
        m=load_implementation(50); r=m.run({'required_capabilities':['x']},headless={'capabilities':['x'],'authority':'decision_only'},gui={'capabilities':['x'],'authority':'decision_only','human_visible':True},require_human_visible=True); self.assertEqual(r['selected']['mode'],'gui')
    def test_050_authority_refusal(self):
        m=load_implementation(50); r=m.run({},headless={'capabilities':[],'authority':'native'},gui=None,max_authority='decision_only'); self.assertEqual(r['verdict'],'REFUSE')
    def test_050_no_execution(self):
        m=load_implementation(50); r=m.run({},headless={'capabilities':[],'authority':'read_only'},gui=None); self.assertFalse(r['executed'])

if __name__=='__main__': unittest.main()
