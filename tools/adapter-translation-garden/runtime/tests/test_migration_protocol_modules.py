from __future__ import annotations
import unittest
from tools.module_loader import load_implementation


class MigrationProtocolTests(unittest.TestCase):
    def test_030_required_without_default_refuses(self):
        m=load_implementation(30); r=m.run({'properties':{}},{'properties':{'x':{'type':'string'}},'required':['x']}); self.assertEqual(r['verdict'],'REFUSE')
    def test_030_default_makes_plan(self):
        m=load_implementation(30); r=m.run({'properties':{}},{'properties':{'x':{'type':'string'}},'required':['x']},defaults={'x':'a'}); self.assertEqual(r['verdict'],'PLAN_READY')
    def test_030_rename(self):
        m=load_implementation(30); r=m.run({'properties':{'old':{'type':'string'}}},{'properties':{'new':{'type':'string'}}},rename_map={'old':'new'}); self.assertEqual(r['steps'][0]['operation'],'rename')
    def test_030_remove_visible(self):
        m=load_implementation(30); r=m.run({'properties':{'old':{'type':'string'}}},{'properties':{}}); self.assertEqual(r['verdict'],'REVIEW_REQUIRED')
    def test_030_never_executes(self):
        m=load_implementation(30); r=m.run({'properties':{}},{'properties':{}}); self.assertFalse(r['migration_executed'])

    def test_031_binding_found(self):
        m=load_implementation(31); r=m.run({'operationId':'list','method':'get','path':'/x'}, {'list':{}}); self.assertEqual(r['verdict'],'BOUND')
    def test_031_missing_function_refuses(self):
        m=load_implementation(31); r=m.run({'operationId':'list'}, {}); self.assertEqual(r['verdict'],'REFUSE')
    def test_031_build_call_required(self):
        m=load_implementation(31); b=m.run({'operationId':'get','parameters':[{'name':'id','in':'path','required':True}]},{'get':{}})['binding']; r=m.build_call({'path':{}},b); self.assertEqual(r['verdict'],'REFUSE')
    def test_031_build_call_maps(self):
        m=load_implementation(31); b=m.compile_binding({'operationId':'get','parameters':[{'name':'id','in':'path','required':True}]},{'get':{}},parameter_map={'id':'item_id'})['binding']; r=m.build_call({'path':{'id':3}},b); self.assertEqual(r['kwargs']['item_id'],3)

    def test_032_deterministic_correlation(self):
        m=load_implementation(32); a=m.run('sum',[1,2]); b=m.run('sum',[1,2]); self.assertEqual(a['correlation_id'],b['correlation_id'])
    def test_032_error_response(self):
        m=load_implementation(32); msg=m.response_to_message('x',error={'code':'bad'}); r=m.message_to_response(msg); self.assertEqual(r['verdict'],'ERROR')
    def test_032_result_and_error_invalid(self):
        m=load_implementation(32)
        with self.assertRaises(ValueError): m.response_to_message('x',result=1,error={'x':1})

    def test_033_event_maps(self):
        m=load_implementation(33); r=m.run({'type':'clicked','payload':{'id':1}}, {'clicked':{'command_type':'open','field_map':{'id':'target'}}}); self.assertEqual(r['command']['payload']['target'],1)
    def test_033_unmapped_refuses(self):
        m=load_implementation(33); self.assertEqual(m.run({'type':'x'}, {})['verdict'],'REFUSE')
    def test_033_missing_field_refuses(self):
        m=load_implementation(33); r=m.run({'type':'x','payload':{}},{'x':{'command_type':'y','field_map':{'a':'b'}}}); self.assertEqual(r['verdict'],'REFUSE')

    def test_034_command_maps(self):
        m=load_implementation(34); r=m.run({'type':'save','id':'c1'},{'ok':True},{'save':{'event_type':'saved','field_map':{'ok':'success'}}}); self.assertEqual(r['event']['causation_id'],'c1')
    def test_034_unmapped_refuses(self):
        m=load_implementation(34); self.assertEqual(m.run({'type':'x'},{}, {})['verdict'],'REFUSE')

    def test_035_job_created_pending(self):
        m=load_implementation(35); r=m.run({'function':'x'},job_id='j'); self.assertEqual(r['state'],'pending')
    def test_035_valid_transition(self):
        m=load_implementation(35); job=m.run({},job_id='j'); r=m.transition(job,'start'); self.assertEqual(r['job']['state'],'running')
    def test_035_invalid_terminal_transition(self):
        m=load_implementation(35); job=m.run({},job_id='j'); job=m.transition(job,'start')['job']; job=m.transition(job,'complete')['job']; self.assertEqual(m.transition(job,'start')['verdict'],'REFUSE')
    def test_035_retry_limit(self):
        m=load_implementation(35); job=m.run({},job_id='j',retry_limit=0); job['state']='failed'; self.assertEqual(m.transition(job,'retry')['verdict'],'REFUSE')

    def test_036_pending(self):
        m=load_implementation(36); self.assertEqual(m.run([],correlation_id='x')['verdict'],'PENDING')
    def test_036_complete(self):
        m=load_implementation(36); r=m.run([{'correlation_id':'x','kind':'response','payload':1}],correlation_id='x'); self.assertEqual(r['result'],1)
    def test_036_multiple_terminal_ambiguous(self):
        m=load_implementation(36); msgs=[{'correlation_id':'x','kind':'response'},{'correlation_id':'x','kind':'response'}]; self.assertEqual(m.run(msgs,correlation_id='x')['verdict'],'AMBIGUOUS')
    def test_036_timeout_does_not_wait(self):
        m=load_implementation(36); r=m.run([],correlation_id='x',timeout_reached=True); self.assertEqual(r['verdict'],'TIMEOUT'); self.assertFalse(r['waited'])

    def test_037_exact_media(self):
        m=load_implementation(37); r=m.run('application/json',['text/plain','application/json']); self.assertEqual(r['selected'],'application/json')
    def test_037_quality(self):
        m=load_implementation(37); r=m.run('text/plain;q=.4, application/json;q=.9',['text/plain','application/json']); self.assertEqual(r['selected'],'application/json')
    def test_037_wildcard(self):
        m=load_implementation(37); r=m.run('image/*',['image/png','text/plain']); self.assertEqual(r['selected'],'image/png')
    def test_037_no_match(self):
        m=load_implementation(37); self.assertEqual(m.run('image/png',['text/plain'])['verdict'],'NOT_ACCEPTABLE')

    def test_038_text_frame(self):
        m=load_implementation(38); r=m.run({'opcode':'text','payload':'hi'}); self.assertEqual(r['data'],'hi')
    def test_038_binary_roundtrip(self):
        m=load_implementation(38); e=m.run({'opcode':'binary','payload':b'abc'}); f=m.event_to_websocket(e); self.assertEqual(f['frame']['payload'],b'abc')
    def test_038_control_refuses(self):
        m=load_implementation(38); self.assertEqual(m.run({'opcode':'ping','payload':''})['verdict'],'REFUSE')

    def test_039_unknown_fields_sidecar(self):
        m=load_implementation(39); r=m.run('mqtt',{'topic':'a','payload':1,'retain':True}); self.assertEqual(r['envelope']['source_sidecar']['retain'],True)
    def test_039_explicit_field_map(self):
        m=load_implementation(39); r=m.run('custom',{'body':1},field_map={'body':'payload'}); self.assertEqual(r['envelope']['payload'],1)
    def test_039_denormalize(self):
        m=load_implementation(39); env=m.run('x',{'payload':1})['envelope']; r=m.denormalize(env,target_protocol='y',field_map={'payload':'body'}); self.assertEqual(r['message']['body'],1)

    def test_040_http_not_found(self):
        m=load_implementation(40); r=m.run('http',404); self.assertEqual(r['code'],'NOT_FOUND')
    def test_040_grpc_unavailable_retry_hint(self):
        m=load_implementation(40); r=m.run('grpc',14); self.assertTrue(r['retryable_hint'])
    def test_040_process_success(self):
        m=load_implementation(40); r=m.run('process',0); self.assertTrue(r['ok'])
    def test_040_unknown_preserves_source(self):
        m=load_implementation(40); r=m.run('other','x',message='m'); self.assertEqual(r['source']['message'],'m'); self.assertEqual(r['code'],'UNKNOWN')

if __name__=='__main__': unittest.main()
