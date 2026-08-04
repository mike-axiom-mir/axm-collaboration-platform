from __future__ import annotations
import copy
import unittest
from tools.module_loader import load_implementation


class OfflineTransportTests(unittest.TestCase):
    def test_071_normalize(self):
        m=load_implementation(71); r=m.run({'id':'lan','features':['b','a','a']}); self.assertEqual(r['features'],['a','b'])
    def test_071_match_local(self):
        m=load_implementation(71); r=m.match({'features':['queue'],'local_only':True},[{'id':'wan','features':['queue']},{'id':'lan','features':['queue'],'local_only':True,'verified':True}]); self.assertEqual(r['selected']['id'],'lan')
    def test_071_payload_limit(self):
        m=load_implementation(71); r=m.match({'payload_bytes':10},[{'id':'tiny','max_payload_bytes':5}]); self.assertEqual(r['verdict'],'REFUSE')
    def test_071_never_connects(self):
        m=load_implementation(71); r=m.match({},[{'id':'x'}]); self.assertFalse(r['connected'])

    def test_076_enqueue(self):
        m=load_implementation(76); r=m.enqueue([],{'x':1},item_id='i',idempotency_key='k',sequence=1,created_at='t'); self.assertEqual(r['verdict'],'ENQUEUED')
    def test_076_duplicate_key(self):
        m=load_implementation(76); q=m.enqueue([],1,item_id='i',idempotency_key='k',sequence=1,created_at='t')['queue']; r=m.enqueue(q,2,item_id='j',idempotency_key='k',sequence=2,created_at='t'); self.assertEqual(r['verdict'],'DUPLICATE')
    def test_076_replay_order(self):
        m=load_implementation(76); q=[{'item_id':'b','idempotency_key':'b','sequence':2,'state':'pending'},{'item_id':'a','idempotency_key':'a','sequence':1,'state':'pending'}]; r=m.run(q); self.assertEqual([x['item_id'] for x in r['items']],['a','b'])
    def test_076_acknowledged_skipped(self):
        m=load_implementation(76); q=[{'item_id':'a','idempotency_key':'a','sequence':1,'state':'pending'}]; self.assertEqual(m.run(q,acknowledged_keys=['a'])['count'],0)
    def test_076_ack_plan(self):
        m=load_implementation(76); q=[{'item_id':'a','state':'pending'}]; r=m.acknowledge(q,'a'); self.assertEqual(r['queue'][0]['state'],'acknowledged')

    def test_077_package_roundtrip(self):
        m=load_implementation(77); p=m.run(b'abcdef',package_id='p',chunk_size=2); r=m.verify_package(p); self.assertTrue(r['valid']); self.assertEqual(r['payload'],b'abcdef')
    def test_077_tamper_detected(self):
        m=load_implementation(77); p=m.run(b'abc',package_id='p',chunk_size=2); p=copy.deepcopy(p); p['chunks'][0]['data_base64']='YQ=='; self.assertFalse(m.verify_package(p)['valid'])
    def test_077_chunk_sequence_detected(self):
        m=load_implementation(77); p=m.run(b'abc',package_id='p',chunk_size=1); p['chunks'][1]['index']=4; self.assertFalse(m.verify_package(p)['valid'])
    def test_077_receipt(self):
        m=load_implementation(77); p=m.run(b'a',package_id='p'); r=m.receipt(p,receiver_id='r',received_at='t',verified=True); self.assertTrue(r['verified'])

    def test_078_clean_sequence(self):
        m=load_implementation(78); r=m.run([{'sequence':1},{'sequence':2}]); self.assertEqual(r['verdict'],'PASS')
    def test_078_gap_visible(self):
        m=load_implementation(78); r=m.run([{'sequence':1},{'sequence':3}]); self.assertTrue(any(x['kind']=='sequence_gaps' for x in r['findings']))
    def test_078_duplicate_visible(self):
        m=load_implementation(78); r=m.run([{'sequence':1},{'sequence':1}]); self.assertTrue(any(x['kind']=='duplicate_sequence' for x in r['findings']))
    def test_078_clock_offset(self):
        m=load_implementation(78); r=m.run([{'sequence':1,'device_time_ms':100,'reference_time_ms':150}]); self.assertEqual(r['clock_offset_estimate_ms'],50)
    def test_078_does_not_change_clock(self):
        m=load_implementation(78); self.assertFalse(m.run([])['clock_changed'])

    def test_079_selects_within_budget(self):
        m=load_implementation(79); c=[{'id':'hi','bandwidth_kbps':1000,'power_cost':1,'quality':1},{'id':'lo','bandwidth_kbps':100,'power_cost':.2,'quality':.6}]; r=m.run(c,bandwidth_kbps=200,power_budget=.5); self.assertEqual(r['selected']['id'],'lo')
    def test_079_refuses_when_none_fit(self):
        m=load_implementation(79); r=m.run([{'id':'x','bandwidth_kbps':1000,'power_cost':1,'quality':1}],bandwidth_kbps=10,power_budget=.1); self.assertEqual(r['verdict'],'REFUSE')
    def test_079_degradation_visible(self):
        m=load_implementation(79); c=[{'id':'hi','bandwidth_kbps':1000,'power_cost':1,'quality':1},{'id':'lo','bandwidth_kbps':100,'power_cost':.2,'quality':.5}]; r=m.run(c,bandwidth_kbps=200,power_budget=.5); self.assertTrue(r['degradation']['visible'])
    def test_079_deterministic_tie(self):
        m=load_implementation(79); c=[{'id':'b','bandwidth_kbps':1,'power_cost':0,'quality':1},{'id':'a','bandwidth_kbps':1,'power_cost':0,'quality':1}]; r=m.run(c,bandwidth_kbps=10,power_budget=1); self.assertEqual(r['selected']['id'],'a')

if __name__=='__main__': unittest.main()
