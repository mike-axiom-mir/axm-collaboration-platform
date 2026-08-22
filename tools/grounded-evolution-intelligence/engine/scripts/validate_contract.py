#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, sys
from datetime import datetime, timezone
from pathlib import Path
from jsonschema import Draft202012Validator

BASE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE/'scripts'))
from rebuild_state import rebuild

MAP = {
    'evidence_record.json':'evidence_record.schema.json',
    'module_passport_human_capability_atlas_reference.json':'module_passport.schema.json',
    'module_passport_human_interface_intelligence_reference.json':'module_passport.schema.json',
    'module_passport_grounded_evolution_intelligence.json':'module_passport.schema.json',
    'capability_record.json':'capability_record.schema.json',
    'interface_intelligence_reference.json':'interface_intelligence_reference.schema.json',
    'dependency_edge.json':'dependency_edge.schema.json',
    'improvement_need.json':'improvement_need.schema.json',
    'evolution_direction.json':'evolution_direction.schema.json',
    'intervention_record.json':'intervention_record.schema.json',
    'steward_decision.json':'steward_decision.schema.json',
    'exchange_packet.json':'exchange_packet.schema.json',
}

def sha(obj):
    data=json.dumps(obj,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
    return 'sha256:'+hashlib.sha256(data).hexdigest()

schema_results=[]
for p in sorted((BASE/'schemas').glob('*.json')):
    try:
        schema=json.loads(p.read_text())
        Draft202012Validator.check_schema(schema)
        schema_results.append({'schema':p.name,'valid':True,'error':None})
    except Exception as e:
        schema_results.append({'schema':p.name,'valid':False,'error':str(e)})

example_results=[]
for example_name,schema_name in MAP.items():
    try:
        instance=json.loads((BASE/'examples'/example_name).read_text())
        schema=json.loads((BASE/'schemas'/schema_name).read_text())
        Draft202012Validator(schema).validate(instance)
        example_results.append({'example':example_name,'schema':schema_name,'valid':True,'error':None})
    except Exception as e:
        example_results.append({'example':example_name,'schema':schema_name,'valid':False,'error':str(e)})

# Validate every event and rebuild twice.
event_schema=json.loads((BASE/'schemas/event_envelope.schema.json').read_text())
event_validator=Draft202012Validator(event_schema)
event_chain_valid=True
try:
    for line in (BASE/'examples/event_stream.jsonl').read_text().splitlines():
        if line.strip(): event_validator.validate(json.loads(line))
    state1=rebuild(BASE/'examples/event_stream.jsonl')
    state2=rebuild(BASE/'examples/event_stream.jsonl')
    rebuild_deterministic = json.dumps(state1,sort_keys=True,separators=(',',':')) == json.dumps(state2,sort_keys=True,separators=(',',':'))
except Exception:
    event_chain_valid=False
    rebuild_deterministic=False
    state1={'state_hash':'sha256:'+'0'*64}

# Reference integrity across the three modules.
try:
    m1=json.loads((BASE/'examples/module_passport_human_capability_atlas_reference.json').read_text())
    m2=json.loads((BASE/'examples/module_passport_human_interface_intelligence_reference.json').read_text())
    m3=json.loads((BASE/'examples/module_passport_grounded_evolution_intelligence.json').read_text())
    cap=json.loads((BASE/'examples/capability_record.json').read_text())
    iface=json.loads((BASE/'examples/interface_intelligence_reference.json').read_text())
    ev=json.loads((BASE/'examples/evidence_record.json').read_text())
    modules={m1['module_id'],m2['module_id'],m3['module_id']}
    cross_module_references_valid=(
        cap['capability_id']==iface['capability_id'] and
        set(cap['provider_modules']+cap['consumer_modules']).issubset(modules) and
        iface['source_module_id'] in modules and
        set(ev['relevant_scope']).issuperset({*modules,cap['capability_id'],iface['interface_record_id']}) and
        all(ev['evidence_id'] in obj.get('evidence_references',obj.get('evidence',[])) for obj in [m1,m2,m3,cap,iface])
    )
except Exception:
    cross_module_references_valid=False

acceptance=(all(x['valid'] for x in schema_results) and all(x['valid'] for x in example_results)
            and event_chain_valid and rebuild_deterministic and cross_module_references_valid)
report={
    'contract_version':'0.1.0','generated_at':'2026-08-05T00:30:00Z',
    'schema_results':schema_results,'example_results':example_results,
    'event_chain_valid':event_chain_valid,'rebuild_deterministic':rebuild_deterministic,
    'rebuild_hash':state1['state_hash'],'cross_module_references_valid':cross_module_references_valid,
    'acceptance_passed':acceptance,
    'limitations':['Validation uses synthetic Phase 0 fixtures.','Real Module 1 and Module 2 output adapters are not imported yet.','Full factual kernel and diagnosis engine remain future phases.']
}
(BASE/'generated/phase0_validation_report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
(BASE/'generated/reconstructed_state.json').write_text(json.dumps(state1,indent=2,sort_keys=True,ensure_ascii=False)+'\n')
print(json.dumps({'status':'PASS' if acceptance else 'FAIL','schemas':len(schema_results),'examples':len(example_results),'event_chain_valid':event_chain_valid,'rebuild_deterministic':rebuild_deterministic,'cross_module_references_valid':cross_module_references_valid,'state_hash':state1['state_hash']},indent=2))
raise SystemExit(0 if acceptance else 1)
