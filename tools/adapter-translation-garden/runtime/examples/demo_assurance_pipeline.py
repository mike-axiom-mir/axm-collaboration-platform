from __future__ import annotations
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'shared'))
from axm_translation_core import inspect_json_value,new_proof_chain,append_proof_event,verify_proof_chain,build_replay_record,verify_replay_record
request={'operation':'translate','payload':{'name':'Axiom–Mir','count':3}}
guard=inspect_json_value(request)
chain=append_proof_event(new_proof_chain('demo'),event_type='guard',module_id='axm.shared.input-guard',evidence=guard,claims=['bounded','no_execution'])
record=build_replay_record(replay_id='demo-replay',module_id='axm.shared.input-guard',module_version='1',request=request,output=guard,authority={'mode':'inspect_only'},proof_tip=chain['tip'])
print(json.dumps({'guard':guard,'chain_verification':verify_proof_chain(chain),'replay_verification':verify_replay_record(record,request=request,output=guard,authority={'mode':'inspect_only'},proof_tip=chain['tip'])},indent=2,ensure_ascii=False))
