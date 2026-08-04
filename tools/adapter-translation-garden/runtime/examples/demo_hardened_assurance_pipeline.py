from __future__ import annotations
import json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'shared'))
from axm_translation_core import inspect_json_value,evaluate_resource_budget,new_provenance,release_decision,new_proof_chain,append_proof_event,verify_proof_chain
payload={'name':'Axiom–Mir','values':[1,2,3]}
guard=inspect_json_value(payload)
budget=evaluate_resource_budget({'nodes':guard['stats']['nodes']},{'nodes':1000})
provenance=new_provenance(source_id='demo',classification='internal',consent_scopes=['translate'])
release=release_decision(provenance,target_max_classification='internal',required_scope='translate')
chain=append_proof_event(new_proof_chain('hardening-demo'),event_type='assurance',module_id='axm.shared.assurance',evidence={'guard':guard,'budget':budget,'release':release},claims=['no_network','no_write','no_execution'])
print(json.dumps({'guard':guard,'budget':budget,'release':release,'chain':verify_proof_chain(chain)},indent=2,ensure_ascii=False))
