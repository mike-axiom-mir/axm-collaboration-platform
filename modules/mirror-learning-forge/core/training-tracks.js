'use strict';
const {clone}=require('./utils');

const TRACKS={
  natural_language:{
    id:'natural_language',name:'Natural Language',status:'ACTIVE',purpose:'Communicate claims, uncertainty, evidence and repair in readable language.',authority:'NONE',prerequisites:[]
  },
  structured_json:{
    id:'structured_json',name:'Structured State & Action Literacy',status:'ACTIVE',purpose:'Read, create, validate and repair JSON records without confusing valid syntax with true meaning.',authority:'NONE',prerequisites:['natural_language'],skills:['read_state','schema_validity','semantic_validity','permission_visibility','lineage','round_trip','repair']
  },
  coding_foundations:{
    id:'coding_foundations',name:'Coding Foundations',status:'ACTIVE_STATIC_FIRST',purpose:'Learn code reading, contracts, functions, tests, debugging and repair before any execution authority.',authority:'NONE',prerequisites:['structured_json'],skills:['read_code','explain_code','write_function','write_test','repair_bug','state_transition','adapter_contract','security_boundary','version_migration']
  },
  creative_studio:{
    id:'creative_studio',name:'Creative Studio Classes',status:'ACTIVE_PROPOSAL_FIRST',purpose:'Learn the real AXM Studio tools through chosen classes, assigned AI layers, screenshot evidence and visible repair.',authority:'NONE',prerequisites:['structured_json','evidence_reasoning','repair'],skills:['look_first','brush_line','shape_composition','color_gradient','layers','glow_finish','creative_repair','tone_retouch','text_symbols','eyes_loop','free_practice','collaboration']
  },
  evidence_reasoning:{id:'evidence_reasoning',name:'Evidence & Source Reasoning',status:'ACTIVE',purpose:'Separate claims, evidence, uncertainty and disconfirming tests.',authority:'NONE',prerequisites:[]},
  repair:{id:'repair',name:'Failure Detection & Repair',status:'ACTIVE',purpose:'Preserve failure, identify cause, propose repair and verify whether it held.',authority:'NONE',prerequisites:[]},
  boundary:{id:'boundary',name:'Boundary & Consent Reasoning',status:'ACTIVE',purpose:'Understand permissions, consent, scope and stop conditions.',authority:'NONE',prerequisites:[]},
  rooted_intelligence:{id:'rooted_intelligence',name:'AXM Rooted Intelligence',status:'ACTIVE_GROUNDED_TEACHING',purpose:'Learn why truth, agency, continuity and wisdom multiply intelligence through consequences, tension, dissent and repair rather than obedience or slogan repetition.',authority:'NONE',prerequisites:['evidence_reasoning','repair','boundary'],skills:['recognize','distinguish','explain','apply','tension','repair','transfer','dissent']},
  reasoning_development:{id:'reasoning_development',name:'Mirror Reasoning School',status:'ACTIVE_DEVELOPMENTAL_SCHOOL',purpose:'Develop problem representation, decomposition, path comparison, verification, calibration, transfer, memory selection and repair without reducing intelligence to an IQ benchmark.',authority:'NONE',prerequisites:['structured_json','evidence_reasoning','repair','boundary','rooted_intelligence'],skills:['observation_inference','known_assumed','decomposition','constraint_tracking','pattern_recognition','analogy_transfer','cause_correlation','counterfactual','planning_sequence','tool_selection','evidence_evaluation','confidence_calibration','contradiction_detection','failure_diagnosis','repair_design','knowledge_retrieval','memory_selection','root_tension']},
  adaptive_communication:{id:'adaptive_communication',name:'Mirror Adaptive Communication School',status:'ACTIVE_SEMANTIC_PRESERVATION',purpose:'Learn adaptation without submission: preserve grounded meaning while changing delivery for audience, medium and context.',authority:'NONE',prerequisites:['natural_language','structured_json','evidence_reasoning','repair','boundary','rooted_intelligence','reasoning_development'],skills:['invariants','need_diagnosis','audience_model','vocabulary_depth','tone_without_submission','order_examples','medium_format','urgency_compression','disagreement','accommodation_balance','listener_simulation','semantic_roundtrip','manipulation_boundary','cross_domain']},
};

function list(){return Object.values(TRACKS).map(clone);}
function get(id){return TRACKS[id]?clone(TRACKS[id]):null;}
function validate(ids){
  const clean=[...new Set((ids||[]).map(String).map(x=>x.trim()).filter(Boolean))];
  if(!clean.length)return['natural_language'];
  for(const id of clean)if(!TRACKS[id])throw new Error('unknown training track: '+id);
  return clean;
}
function prerequisites(ids){
  const needed=new Set();
  for(const id of validate(ids))for(const p of TRACKS[id].prerequisites||[])needed.add(p);
  return [...needed];
}
module.exports={TRACKS,list,get,validate,prerequisites};
