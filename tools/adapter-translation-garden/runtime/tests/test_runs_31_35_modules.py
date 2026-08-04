from __future__ import annotations
import unittest
from tools.module_loader import load_implementation

class Run3135Tests(unittest.TestCase):
    def test_067_exact_match(self):
        m=load_implementation(67); r=m.run({'sha256':'a','files':['x']},[{'id':'p','tested':True,'match':{'sha256':'a','required_files':['x']}}]); self.assertEqual(r['selected']['id'],'p')
    def test_067_untested_rejected(self):
        m=load_implementation(67); r=m.run({},[{'id':'p','tested':False,'match':{}}]); self.assertEqual(r['verdict'],'NO_MATCH')
    def test_067_ambiguous_refused(self):
        m=load_implementation(67); r=m.run({},[{'id':'a','tested':True,'match':{}},{'id':'b','tested':True,'match':{}}]); self.assertTrue(r['ambiguous']); self.assertEqual(r['verdict'],'REFUSE')
    def test_067_no_launch(self):
        m=load_implementation(67); r=m.run({},[]); self.assertFalse(r['launched']); self.assertFalse(r['applied'])

    def test_069_ini_translate(self):
        m=load_implementation(69); r=m.run('[app]\ncount=2\n',source_format='ini',mappings=[{'source':'app.count','target':'runtime.count','type':'integer'}]); self.assertEqual(r['target']['runtime']['count'],2)
    def test_069_boolean(self):
        m=load_implementation(69); r=m.run({'enabled':'yes'},source_format='environment',mappings=[{'source':'enabled','target':'x.enabled','type':'boolean'}]); self.assertTrue(r['target']['x']['enabled'])
    def test_069_sidecar(self):
        m=load_implementation(69); r=m.run({'a':1,'b':2},source_format='preferences',mappings=[{'source':'a','target':'x.a','type':'integer'}]); self.assertEqual(r['unmapped_sidecar'],{'b':2})
    def test_069_no_write(self):
        m=load_implementation(69); r=m.run({},source_format='registry',mappings=[]); self.assertFalse(r['written'])

    def test_072_local_service(self):
        m=load_implementation(72); r=m.run([{'id':'s','service_type':'_axm._tcp','host':'192.168.1.2','verified':True}],allowed_service_types=['_axm._tcp']); self.assertEqual(r['services'][0]['id'],'s')
    def test_072_public_rejected(self):
        m=load_implementation(72); r=m.run([{'id':'s','service_type':'x','host':'8.8.8.8','verified':True}],allowed_service_types=['x']); self.assertFalse(r['services'])
    def test_072_unverified_rejected(self):
        m=load_implementation(72); r=m.run([{'id':'s','service_type':'x','host':'a.local'}],allowed_service_types=['x']); self.assertEqual(r['verdict'],'NO_APPROVED_SERVICES')
    def test_072_no_network(self):
        m=load_implementation(72); r=m.run([],allowed_service_types=[]); self.assertFalse(r['network_access']); self.assertFalse(r['connected'])

    def test_073_consent_event(self):
        m=load_implementation(73); r=m.run({'kind':'nfc_tag','tag_id':'t','payload':'x'},consent_lease={'lease_id':'l','scopes':['proximity:nfc_tag'],'expires_at':'2026-08-01'},allowlist=['t'],now='2026-07-27'); self.assertEqual(r['verdict'],'EVENT_READY')
    def test_073_expired(self):
        m=load_implementation(73); r=m.run({'kind':'pair','device_id':'d'},consent_lease={'lease_id':'l','scopes':['proximity:pair'],'expires_at':'2026-01-01'},allowlist=['d'],now='2026-07-27'); self.assertIn('consent_expired',r['errors'])
    def test_073_not_allowlisted(self):
        m=load_implementation(73); r=m.run({'kind':'pair','device_id':'d'},consent_lease={'lease_id':'l','scopes':['proximity:pair']},allowlist=[],now='2026'); self.assertEqual(r['verdict'],'REFUSE')
    def test_073_no_radio(self):
        m=load_implementation(73); r=m.run({'kind':'pair','device_id':'d'},consent_lease={'lease_id':'l','scopes':['proximity:pair']},allowlist=['d'],now='2026'); self.assertFalse(r['radio_access']); self.assertFalse(r['paired'])

    def test_075_motion_normalize(self):
        m=load_implementation(75); r=m.run({'id':'imu','type':'motion','unit':'m/s2'},[{'timestamp':'1','value':[0,1,0]}],consent_scopes=[]); self.assertEqual(r['samples'][0]['sequence'],0)
    def test_075_sensitive_consent(self):
        m=load_implementation(75); r=m.run({'id':'mic','type':'microphone'},[],consent_scopes=[]); self.assertEqual(r['verdict'],'REFUSE')
    def test_075_non_monotonic(self):
        m=load_implementation(75); r=m.run({'id':'s','type':'custom'},[{'timestamp':'2','value':1},{'timestamp':'1','value':2}],consent_scopes=[]); self.assertEqual(r['verdict'],'PARTIAL')
    def test_075_no_capture(self):
        m=load_implementation(75); r=m.run({'id':'s','type':'custom'},[],consent_scopes=[]); self.assertFalse(r['captured'])

    def test_091_register_graph(self):
        m=load_implementation(91); r=m.run([{'id':'a'},{'id':'b'}],[{'id':'e','source':'a','target':'b'}]); self.assertIn('e',r['graph']['edges'])
    def test_091_dangling_edge(self):
        m=load_implementation(91); r=m.run([{'id':'a'}],[{'id':'e','source':'a','target':'b'}]); self.assertTrue(r['errors'])
    def test_091_immutable(self):
        m=load_implementation(91); g=m.empty_graph(); r=m.register_node(g,{'id':'a'}); self.assertNotIn('a',g['nodes']); self.assertIn('a',r['graph']['nodes'])
    def test_091_conflict(self):
        m=load_implementation(91); g=m.register_node(m.empty_graph(),{'id':'a','x':1})['graph']; self.assertEqual(m.register_node(g,{'id':'a','x':2})['verdict'],'REFUSE')

    def test_092_route(self):
        m=load_implementation(92); g={'nodes':{'a':{},'b':{},'c':{}},'edges':{'e1':{'source':'a','target':'b','verified':True,'capabilities':['x']},'e2':{'source':'b','target':'c','verified':True,'capabilities':['x']}}}; r=m.run(g,'a','c',required_capabilities=['x']); self.assertEqual(r['routes'][0]['intermediates'],['b'])
    def test_092_cycle_safe(self):
        m=load_implementation(92); g={'nodes':{'a':{},'b':{},'c':{}},'edges':{'e1':{'source':'a','target':'b','verified':True},'e2':{'source':'b','target':'a','verified':True},'e3':{'source':'b','target':'c','verified':True}}}; self.assertEqual(m.run(g,'a','c')['routes'][0]['nodes'],['a','b','c'])
    def test_092_unverified_filtered(self):
        m=load_implementation(92); g={'nodes':{'a':{},'b':{}},'edges':{'e':{'source':'a','target':'b','verified':False}}}; self.assertEqual(m.run(g,'a','b')['verdict'],'NO_ROUTE')
    def test_092_no_composition(self):
        m=load_implementation(92); g={'nodes':{'a':{},'b':{}},'edges':{}}; r=m.run(g,'a','b'); self.assertFalse(r['executed']); self.assertFalse(r['composed'])

    def test_093_score(self):
        m=load_implementation(93); r=m.run([{'id':'r','metrics':{'quality':1,'semantic_loss':0.2}}],weights={'quality':1,'semantic_loss':1}); self.assertAlmostEqual(r['ranked'][0]['score'],0.8)
    def test_093_missing_metric(self):
        m=load_implementation(93); r=m.run([{'id':'r','metrics':{}}],weights={'quality':1}); self.assertEqual(r['verdict'],'REFUSE')
    def test_093_range_refused(self):
        m=load_implementation(93); r=m.run([{'id':'r','metrics':{'quality':2}}],weights={'quality':1}); self.assertTrue(r['invalid'])
    def test_093_tie_visible(self):
        m=load_implementation(93); r=m.run([{'id':'a','metrics':{'quality':1}},{'id':'b','metrics':{'quality':1}}],weights={'quality':1}); self.assertTrue(r['tie_at_top'])

    def test_095_select(self):
        m=load_implementation(95); r=m.run([{'id':'a','preserved_semantics':['x'],'degradations':[],'quality':1,'cost':0,'latency':0}],required_semantics=['x'],allowed_degradations=[]); self.assertEqual(r['selected']['id'],'a')
    def test_095_missing_semantic(self):
        m=load_implementation(95); r=m.run([{'id':'a','preserved_semantics':[]}],required_semantics=['x'],allowed_degradations=[]); self.assertEqual(r['verdict'],'REFUSE')
    def test_095_material_requires_acceptance(self):
        m=load_implementation(95); r=m.run([{'id':'a','preserved_semantics':['x'],'degradations':['lower_res']}],required_semantics=['x'],allowed_degradations=['lower_res']); self.assertEqual(r['verdict'],'REFUSE')
    def test_095_no_silent(self):
        m=load_implementation(95); r=m.run([],required_semantics=[],allowed_degradations=[]); self.assertFalse(r['silent_approximation'])

    def test_096_key_stable(self):
        m=load_implementation(96); i={k:'x' for k in ('source_hash','contract_hash','adapter_id','adapter_version','options_hash','environment_hash','proof_hash')}; self.assertEqual(m.key(i),m.key(dict(reversed(list(i.items())))))
    def test_096_put_hit(self):
        m=load_implementation(96); i={k:'x' for k in ('source_hash','contract_hash','adapter_id','adapter_version','options_hash','environment_hash','proof_hash')}; entries=m.plan_put({},i,output_reference='o',proof_reference='p')['entries']; self.assertTrue(m.lookup(entries,i)['hit'])
    def test_096_environment_changes_key(self):
        m=load_implementation(96); i={k:'x' for k in ('source_hash','contract_hash','adapter_id','adapter_version','options_hash','environment_hash','proof_hash')}; j=dict(i); j['environment_hash']='y'; self.assertNotEqual(m.key(i),m.key(j))
    def test_096_no_persistence(self):
        m=load_implementation(96); i={k:'x' for k in ('source_hash','contract_hash','adapter_id','adapter_version','options_hash','environment_hash','proof_hash')}; self.assertFalse(m.plan_put({},i,output_reference='o',proof_reference='p')['persisted'])

    def test_097_healthy(self):
        m=load_implementation(97); r=m.run('a',[{'timestamp_epoch':100,'ok':True,'latency_ms':10,'verified':True}],now_epoch=101); self.assertEqual(r['status'],'healthy')
    def test_097_drifted(self):
        m=load_implementation(97); r=m.run('a',[{'timestamp_epoch':100,'ok':True,'verified':True,'contract_drift':True}],now_epoch=101); self.assertEqual(r['status'],'drifted')
    def test_097_stale(self):
        m=load_implementation(97); r=m.run('a',[{'timestamp_epoch':0,'ok':True,'verified':True}],now_epoch=1000,stale_after_seconds=10); self.assertEqual(r['status'],'stale')
    def test_097_passive(self):
        m=load_implementation(97); r=m.run('a',[{'timestamp_epoch':1,'ok':True,'verified':True}],now_epoch=1); self.assertFalse(r['polled']); self.assertEqual(r['actions_performed'],[])

    def test_098_verify(self):
        m=load_implementation(98); p={'manifest':{'id':'a','version':'1.0.0','content_sha256':'h'},'observed_content_sha256':'h','signature_evidence':{'verified':True}}; self.assertEqual(m.run(p,environment={},installed={})['verdict'],'VERIFIED')
    def test_098_hash_mismatch(self):
        m=load_implementation(98); p={'manifest':{'id':'a','version':'1.0.0','content_sha256':'h'},'observed_content_sha256':'x','signature_evidence':{'verified':True}}; self.assertIn('content_hash_mismatch',m.run(p,environment={},installed={})['errors'])
    def test_098_update_must_be_newer(self):
        m=load_implementation(98); p={'manifest':{'id':'a','version':'1.0.0'}}; self.assertEqual(m.plan('update',p,current_version='1.0.0')['verdict'],'REFUSE')
    def test_098_no_install(self):
        m=load_implementation(98); p={'manifest':{'id':'a','version':'1.0.0','content_sha256':'h'},'observed_content_sha256':'h','signature_evidence':{'verified':True}}; self.assertFalse(m.run(p,environment={},installed={})['installed']); self.assertFalse(m.plan('install',p)['performed'])

if __name__=='__main__': unittest.main()
