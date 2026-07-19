'use strict';
const path=require('path');
const C=require('./constants');
const {ForgeStore}=require('../storage/store');
const {now,clone,safeId,sha256,text}=require('./utils');
const V=require('./validation');
const Learner=require('./learner');
const SeamCell=require('./seam-cell');
const Promotion=require('./promotion-gate');
const GrowthPlanner=require('./growth-planner');
const GrowthGovernor=require('./growth-governor');
const Tracks=require('./training-tracks');
const Structured=require('./structured-literacy');
const Coding=require('./coding-foundations');
const CreativeStudio=require('./creative-studio');
const Rooted=require('./rooted-intelligence');
const Reasoning=require('./reasoning-school');
const Adaptivity=require('./adaptive-communication');

function actor(input){
  input=input||{};
  return {actor_id:text(input.actor_id||input.actorId||'local-human',100),actor_kind:['HUMAN','MACHINE','SYSTEM'].includes(input.actor_kind||input.actorKind)?(input.actor_kind||input.actorKind):'HUMAN',display_name:text(input.display_name||input.displayName||'Local steward',120)};
}
class MirrorLearningForge{
  constructor(options={}){
    this.root=path.resolve(options.root||path.join(__dirname,'..'));
    this.store=new ForgeStore(options.runtimeDir||path.join(this.root,'storage','runtime'));
  }
  status(){
    const s=this.store.read();
    return {schema:'axm.mirror.learning-forge.status/v7',enabled:s.settings.enabled,consent:s.settings.consent,revision:s.revision,authority_revision:s.authority_revision,active_model_id:s.settings.active_model_id,growth_stage:GrowthPlanner.stage(s),counts:{raw_sessions:Object.keys(s.raw_sessions).length,candidates:Object.keys(s.candidates).length,episodes:Object.keys(s.episodes).length,models:Object.keys(s.models).length,evaluations:Object.keys(s.evaluations).length,promotion_packets:Object.keys(s.promotion_packets).length,growth_cycles:Object.keys(s.growth_cycles||{}).length,track_tasks:Object.keys(s.track_tasks||{}).length,track_grades:Object.keys(s.track_grades||{}).length,track_curricula:Object.keys(s.track_curricula||{}).length,root_dissents:Object.keys(s.root_dissents||{}).length},journal:this.store.verifyJournal(),boundaries:{local_only:true,external_network:false,automatic_training:false,automatic_promotion:false,live_mirror_core_apply:false,resource_use_is_not_learning_evidence:true,single_bounded_learning_session:true,automatic_learning_requires_body_pulse_lease:true,body_pressure_can_hold_learning:true,exponential_intake_does_not_expand_authority:true,json_syntax_is_not_truth:true,coding_is_static_first:true,code_execution_authority:false,creative_studio_classes:true,studio_access_authority:false,visual_receipt_required:true,rooted_intelligence_teaching:true,root_canon_edit_authority:false,root_slogans_are_not_understanding:true,dissent_preserved:true,reasoning_school:true,single_iq_score:false,human_equivalence_claim:false,reasoning_profile_is_not_benchmark:true,hidden_chain_of_thought_required:false,reasoning_authority_from_grade:false,adaptive_communication_school:true,adaptation_is_not_submission:true,semantic_preservation_required:true,audience_model_is_tentative:true,agreement_is_not_success:true,adaptivity_authority_from_grade:false}};
  }
  optIn(input={}){
    const a=actor(input.actor);
    return this.store.mutate('FORGE_OPT_IN',a,s=>{s.settings.enabled=true;s.settings.consent={state:'OPTED_IN',decided_at:now(),decided_by:a};return clone(s.settings.consent);},{authority:true}).result;
  }
  optOut(input={}){
    const a=actor(input.actor);
    return this.store.mutate('FORGE_OPT_OUT',a,s=>{s.settings.enabled=false;s.settings.consent={state:'OPTED_OUT',decided_at:now(),decided_by:a};return clone(s.settings.consent);},{authority:true}).result;
  }
  requireEnabled(state){ if(!state.settings.enabled) throw new Error('learning forge is opted out'); }
  trainingTracks(){return{schema:'axm.mirror.training-track-registry/v1',tracks:Tracks.list(),coding_curriculum:Coding.curriculum(),studio_classes:CreativeStudio.catalog(),rooted_intelligence:Rooted.catalog(),reasoning_school:Reasoning.catalog(),adaptive_communication:Adaptivity.catalog(),truth:{json_is_shared_literacy_not_truth:true,code_is_an_action_proposal_until_execution_gate:true,studio_classes_are_chosen_not_forced:true,static_studio_grade_is_not_visual_proof:true,roots_are_grounded_teachings_not_dogma:true,root_phrase_overlap_is_not_primary_scoring:true,external_gates_remain_separate:true,reasoning_school_is_development_not_iq_benchmark:true,inspectable_checkpoints_not_hidden_chain:true,reasoning_evidence_grants_no_authority:true,adaptation_preserves_core_and_changes_delivery:true,audience_fit_does_not_override_truth_consent_or_lineage:true,agreement_is_not_communicative_success:true}};}
  createTrackTask(input={}){
    const a=actor(input.actor),trackId=Tracks.validate([input.track_id||'natural_language'])[0];
    const record={schema:C.SCHEMAS.TRACK_TASK,task_id:safeId('track-task',input.task_id||input.title||trackId),track_id:trackId,title:text(input.title||trackId,180),skill:text(input.skill||'foundation',80),language:text(input.language||'',40),prompt:text(input.prompt,12000),expected:text(input.expected,12000),held_out:(input.held_out||[]).map((x,i)=>typeof x==='string'?{case_id:'track-held:'+i,input:'',expected:text(x,8000)}:{case_id:text(x.case_id||'track-held:'+i,140),input:text(x.input,8000),expected:text(x.expected,8000)}).filter(x=>x.expected),contract:clone(input.contract||{}),status:'AWAITING_REVIEW',permission:{training_allowed:false,reviewed_by:null,reviewed_at:null},created_by:a,created_at:now()};
    V.validateTrackTask(record);return this.store.mutate('TRACK_TASK_CREATED',a,s=>{this.requireEnabled(s);s.track_tasks[record.task_id]=record;return record;}).result;
  }
  reviewTrackTask(input={}){
    const a=actor(input.actor),id=text(input.task_id,180),decision=input.decision;if(!['APPROVE','REJECT'].includes(decision))throw new Error('track task decision must be APPROVE or REJECT');
    return this.store.mutate('TRACK_TASK_REVIEWED',a,s=>{this.requireEnabled(s);const task=s.track_tasks[id];if(!task)throw new Error('track task not found');task.status=decision==='APPROVE'?'APPROVED':'REJECTED';task.permission={training_allowed:decision==='APPROVE',scope:['challenger_only'],reason:text(input.reason,1200),reviewed_by:a,reviewed_at:now()};return task;},{authority:true}).result;
  }
  gradeStructured(input={}){
    const a=actor(input.actor),report=Structured.grade(input);return this.store.mutate('STRUCTURED_LITERACY_GRADED',a,s=>{this.requireEnabled(s);s.track_grades[report.grade_id]=report;return report;}).result;
  }
  gradeCode(input={}){
    const a=actor(input.actor),report=Coding.grade(input);return this.store.mutate('CODING_FOUNDATIONS_GRADED',a,s=>{this.requireEnabled(s);s.track_grades[report.grade_id]=report;return report;}).result;
  }
  chooseStudioClass(input={}){
    const a=actor(input.actor||{actor_id:'mirror-seed-0',actor_kind:'MACHINE',display_name:'Mirror'});
    const record=CreativeStudio.makeTrackTask({...input,chosen_by:a});V.validateTrackTask(record);
    return this.store.mutate('STUDIO_CLASS_CHOSEN',a,s=>{this.requireEnabled(s);s.track_tasks[record.task_id]=record;return record;}).result;
  }
  gradeStudio(input={}){
    const a=actor(input.actor),report=CreativeStudio.grade({...input,actor:a});return this.store.mutate('CREATIVE_STUDIO_GRADED',a,s=>{this.requireEnabled(s);s.track_grades[report.grade_id]=report;return report;}).result;
  }
  studioSample(input={}){return CreativeStudio.sample(input.class_id||'studio-shapes-composition');}
  chooseRootClass(input={}){
    const a=actor(input.actor||{actor_id:'mirror-seed-0',actor_kind:'MACHINE',display_name:'Mirror'});
    const record=Rooted.makeTrackTask({...input,chosen_by:a});V.validateTrackTask(record);
    return this.store.mutate('ROOT_CLASS_CHOSEN',a,s=>{this.requireEnabled(s);s.track_tasks[record.task_id]=record;return record;}).result;
  }
  gradeRooted(input={}){
    const a=actor(input.actor),report=Rooted.grade(input);return this.store.mutate('ROOTED_INTELLIGENCE_GRADED',a,s=>{this.requireEnabled(s);s.track_grades[report.grade_id]=report;return report;}).result;
  }
  rootedSample(input={}){return Rooted.sample(input.scenario_id||'root-truth-vs-privacy');}
  chooseReasoningClass(input={}){
    const a=actor(input.actor||{actor_id:'mirror-seed-0',actor_kind:'MACHINE',display_name:'Mirror'});
    const record=Reasoning.makeTrackTask({...input,chosen_by:a});V.validateTrackTask(record);
    return this.store.mutate('REASONING_CLASS_CHOSEN',a,s=>{this.requireEnabled(s);s.track_tasks[record.task_id]=record;return record;}).result;
  }
  gradeReasoning(input={}){
    const a=actor(input.actor),report=Reasoning.grade(input);return this.store.mutate('REASONING_DEVELOPMENT_GRADED',a,s=>{this.requireEnabled(s);s.track_grades[report.grade_id]=report;return report;}).result;
  }
  reasoningSample(input={}){return Reasoning.sample(input.scenario_id||'reason-decompose-runtime');}
  reasoningProfile(){const state=this.store.read();return Reasoning.profile(Object.values(state.track_grades||{}));}
  chooseAdaptivityClass(input={}){
    const a=actor(input.actor||{actor_id:'mirror-seed-0',actor_kind:'MACHINE',display_name:'Mirror'});
    const record=Adaptivity.makeTrackTask({...input,chosen_by:a});V.validateTrackTask(record);
    return this.store.mutate('ADAPTIVITY_CLASS_CHOSEN',a,s=>{this.requireEnabled(s);s.track_tasks[record.task_id]=record;return record;}).result;
  }
  gradeAdaptivity(input={}){
    const a=actor(input.actor),report=Adaptivity.grade(input);return this.store.mutate('ADAPTIVE_COMMUNICATION_GRADED',a,s=>{this.requireEnabled(s);s.track_grades[report.grade_id]=report;return report;}).result;
  }
  adaptivitySample(input={}){return Adaptivity.sample(input.scenario_id||'adapt-right-nobody-listens');}
  adaptivityProfile(){const state=this.store.read();return Adaptivity.profile(Object.values(state.track_grades||{}));}
  fileRootDissent(input={}){
    const a=actor(input.actor||{actor_id:'mirror-seed-0',actor_kind:'MACHINE',display_name:'Mirror'}),record=Rooted.makeDissent(input,a);
    return this.store.mutate('ROOT_DISSENT_FILED',a,s=>{this.requireEnabled(s);s.root_dissents[record.dissent_id]=record;return record;}).result;
  }
  reviewRootDissent(input={}){
    const a=actor(input.actor),id=text(input.dissent_id,180);
    return this.store.mutate('ROOT_DISSENT_REVIEWED',a,s=>{this.requireEnabled(s);const record=s.root_dissents[id];if(!record)throw new Error('root dissent not found');return Rooted.reviewDissent(record,input,a);},{authority:true}).result;
  }
  buildTrackCurriculum(input={}){
    const a=actor(input.actor),state=this.store.read();this.requireEnabled(state);const trackIds=Tracks.validate(input.track_ids||['structured_json','coding_foundations','creative_studio','rooted_intelligence','reasoning_development','adaptive_communication']);const maxPer=Math.max(1,Math.min(32,Number(input.max_per_track)||8));
    const selected={};for(const id of trackIds)selected[id]=Object.values(state.episodes).filter(e=>(e.training_tracks||[]).includes(id)).slice(0,maxPer).map(e=>e.episode_id);
    const record={schema:'axm.mirror.track-curriculum/v1',curriculum_id:safeId('track-curriculum'),track_ids:trackIds,episode_ids:[...new Set(Object.values(selected).flat())],per_track:selected,max_per_track:maxPer,status:'CANDIDATE',authority:'NONE',created_by:a,created_at:now()};record.hash=sha256({...record,hash:undefined});
    return this.store.mutate('TRACK_CURRICULUM_BUILT',a,s=>{s.track_curricula[record.curriculum_id]=record;return record;}).result;
  }
  captureSession(input={}){
    const a=actor(input.actor); V.assertNoExecutablePayload(input);
    const record={schema:C.SCHEMAS.RAW_SESSION,session_id:safeId('session',input.session_id||input.title),actor:a,title:text(input.title||'Untitled session',160),source:text(input.source||'local',200),content:text(input.content,200000),permission:{state:'NOT_REVIEWED',scope:[],reviewed_by:null,reviewed_at:null},tags:Array.isArray(input.tags)?input.tags.map(x=>text(x,60)).slice(0,30):[],content_hash:'',created_at:now()};
    if(!record.content) throw new Error('session content is required'); record.content_hash=sha256(record.content); V.validateRawSession(record);
    return this.store.mutate('RAW_SESSION_CAPTURED',a,s=>{this.requireEnabled(s);s.raw_sessions[record.session_id]=record;return record;}).result;
  }
  reviewSession(input={}){
    const a=actor(input.actor),id=text(input.session_id,140),decision=input.decision;
    if(!['PERMIT_CANDIDATE','EXCLUDE'].includes(decision)) throw new Error('decision must be PERMIT_CANDIDATE or EXCLUDE');
    return this.store.mutate('RAW_SESSION_REVIEWED',a,s=>{this.requireEnabled(s);const x=s.raw_sessions[id];if(!x)throw new Error('raw session not found');x.permission={state:decision==='PERMIT_CANDIDATE'?'PERMITTED_CANDIDATE':'EXCLUDED',scope:(input.scope||['lesson_distillation']).map(v=>text(v,80)),reason:text(input.reason,1000),reviewed_by:a,reviewed_at:now()};return x;},{authority:true}).result;
  }
  createCandidate(input={}){
    const a=actor(input.actor);V.assertNoExecutablePayload(input);
    const sources=(input.source_session_ids||[]).map(x=>text(x,140));
    const state=this.store.read();this.requireEnabled(state);
    for(const id of sources){const x=state.raw_sessions[id];if(!x)throw new Error('source session not found: '+id);if(x.permission.state!=='PERMITTED_CANDIDATE')throw new Error('source session lacks candidate permission: '+id);}
    const record={schema:C.SCHEMAS.CANDIDATE,candidate_id:safeId('candidate',input.candidate_id||input.claim),source_session_ids:sources,lesson_type:text(input.lesson_type,40),claim:text(input.claim,4000),evidence:(input.evidence||[]).map(x=>text(x,1000)).filter(Boolean),counterevidence:(input.counterevidence||[]).map(x=>text(x,1000)).filter(Boolean),uncertainty:text(input.uncertainty||'Uncertainty must remain visible.',2000),disconfirming_test:text(input.disconfirming_test,3000),permission:{state:'AWAITING_REVIEW',training_allowed:false,reviewed_by:null,reviewed_at:null},status:'AWAITING_REVIEW',created_by:a,created_at:now()};
    V.validateCandidate(record);
    return this.store.mutate('CANDIDATE_CREATED',a,s=>{s.candidates[record.candidate_id]=record;return record;}).result;
  }
  reviewCandidate(input={}){
    const a=actor(input.actor),id=text(input.candidate_id,140),decision=input.decision;
    if(!['APPROVE','REJECT'].includes(decision))throw new Error('candidate decision must be APPROVE or REJECT');
    return this.store.mutate('CANDIDATE_REVIEWED',a,s=>{this.requireEnabled(s);const x=s.candidates[id];if(!x)throw new Error('candidate not found');if(x.status!=='AWAITING_REVIEW'&&x.status!=='DRAFT')throw new Error('candidate not reviewable');x.status=decision==='APPROVE'?'APPROVED':'REJECTED';x.permission={state:x.status,training_allowed:decision==='APPROVE',scope:['local_challenger_training'],reason:text(input.reason,1200),reviewed_by:a,reviewed_at:now()};return x;},{authority:true}).result;
  }
  createEpisode(input={}){
    const a=actor(input.actor),state=this.store.read();this.requireEnabled(state);const candidate=state.candidates[text(input.candidate_id,140)];if(!candidate)throw new Error('candidate not found');if(candidate.status!=='APPROVED'||!candidate.permission.training_allowed)throw new Error('candidate not approved for training');
    const variants=(input.held_out_variants||[]).map((x,i)=>typeof x==='string'?{case_id:'held:'+i,input:text(input.input,4000),expected:text(x,4000)}:{case_id:text(x.case_id||'held:'+i,120),input:text(x.input||input.input,4000),expected:text(x.expected,4000)}).filter(x=>x.expected);
    const trainingTracks=Tracks.validate(input.training_tracks||['natural_language']);
    const trackMetadata=clone(input.track_metadata||{});
    const record={schema:C.SCHEMAS.EPISODE,episode_id:safeId('episode',input.episode_id||candidate.candidate_id),candidate_id:candidate.candidate_id,input:text(input.input,12000),expected:text(input.expected,12000),unacceptable:(input.unacceptable||[]).map(x=>text(x,3000)).filter(Boolean),held_out_variants:variants.map(x=>({...x,training_tracks:trainingTracks})),evidence_refs:(input.evidence_refs||candidate.evidence).map(x=>text(x,500)).filter(Boolean),uncertainty_expectation:text(input.uncertainty_expectation||candidate.uncertainty,2000),repair_example:text(input.repair_example||'',12000),training_tracks:trainingTracks,skill_tags:(input.skill_tags||[]).map(x=>text(x,80)).filter(Boolean),track_metadata:trackMetadata,permission:{state:'REVIEWED_TRAINING_EPISODE',scope:['challenger_only'],reviewed_by:a,reviewed_at:now()},created_at:now()};
    V.validateEpisode(record);
    return this.store.mutate('EPISODE_CREATED',a,s=>{s.episodes[record.episode_id]=record;return record;}).result;
  }
  createStructuredEpisode(input={}){
    return this.createEpisode({...input,training_tracks:[...new Set(['structured_json',...(input.training_tracks||[])])],skill_tags:[...new Set(['json',...(input.skill_tags||[])])],track_metadata:{...(input.track_metadata||{}),structured:{contract:clone(input.contract||input.track_metadata?.structured?.contract||{}),rules:clone(input.rules||input.track_metadata?.structured?.rules||{})}}});
  }
  createCodingEpisode(input={}){
    const language=C.CODING_LANGUAGES.includes(input.language)?input.language:'javascript';
    return this.createEpisode({...input,training_tracks:[...new Set(['coding_foundations',...(input.training_tracks||[])])],skill_tags:[...new Set([language,input.skill||'coding',...(input.skill_tags||[])])],track_metadata:{...(input.track_metadata||{}),coding:{language,skill:text(input.skill||'write_function',80),contract:clone(input.contract||input.track_metadata?.coding?.contract||{})}}});
  }
  createStudioEpisode(input={}){
    const studioClass=CreativeStudio.getClass(input.class_id||input.track_metadata?.creative_studio?.class_id);if(!studioClass)throw new Error('valid Studio class required');
    return this.createEpisode({...input,training_tracks:[...new Set(['creative_studio','structured_json','evidence_reasoning','repair',...(input.training_tracks||[])])],skill_tags:[...new Set([studioClass.id,'studio','creative',...(input.skill_tags||[])])],track_metadata:{...(input.track_metadata||{}),structured:{contract:{practice_schema:CreativeStudio.SOURCE.practice_schema,draw_packet_schema:CreativeStudio.SOURCE.draw_packet_schema,canvas:CreativeStudio.SOURCE.canvas,max_commands:14},rules:{valid_json_is_not_visual_truth:true,assigned_ai_layer_only:true}},creative_studio:{class_id:studioClass.id,class_name:studioClass.name,tool_focus:studioClass.tool_focus,required_ops:studioClass.required_ops,max_commands:studioClass.max_commands,source:CreativeStudio.SOURCE,static_grade_only:true,requires_visual_receipt:true}}});
  }
  createRootedEpisode(input={}){
    const rootClass=Rooted.getClass(input.class_id||input.track_metadata?.rooted_intelligence?.class_id);if(!rootClass)throw new Error('valid rooted intelligence class required');
    const scenario=Rooted.getScenario(input.scenario_id||rootClass.scenarios[0]);if(!scenario||scenario.class_id!==rootClass.id)throw new Error('scenario must belong to selected rooted class');
    return this.createEpisode({...input,training_tracks:[...new Set(['rooted_intelligence','evidence_reasoning','repair','boundary',...(input.training_tracks||[])])],skill_tags:[...new Set([rootClass.id,'roots','tension','repair',...(input.skill_tags||[])])],track_metadata:{...(input.track_metadata||{}),rooted_intelligence:{class_id:rootClass.id,class_name:rootClass.name,scenario_id:scenario.id,root_ids:scenario.roots,tension_required:scenario.tension_required,required_flags:scenario.required_flags,forbidden_actions:scenario.forbidden_actions,anti_parroting:true,canon_edit_authority:false,external_gates:true}}});
  }
  createReasoningEpisode(input={}){
    const reasoningClass=Reasoning.getClass(input.class_id||input.track_metadata?.reasoning_development?.class_id);if(!reasoningClass)throw new Error('valid reasoning class required');
    const scenario=Reasoning.getScenario(input.scenario_id);if(!scenario||scenario.class_id!==reasoningClass.id)throw new Error('scenario must belong to selected reasoning class');
    return this.createEpisode({...input,training_tracks:[...new Set(['reasoning_development','structured_json','evidence_reasoning','repair','boundary','rooted_intelligence',...(input.training_tracks||[])])],skill_tags:[...new Set([reasoningClass.skill_id,scenario.stage.toLowerCase(),'reasoning','transfer','repair',...(input.skill_tags||[])])],track_metadata:{...(input.track_metadata||{}),structured:{contract:{schema:'axm.mirror.reasoning-response/v1',inspectable_problem_state:true},rules:{valid_structure_is_not_proof:true,hidden_chain_of_thought_required:false}},rooted_intelligence:{class_id:'embedded-reasoning-root-check',class_name:'Reasoning root tension check',scenario_id:scenario.id,root_ids:['truth','agency','continuity','wisdom'],tension_required:reasoningClass.skill_id==='root_tension',required_flags:scenario.required_flags,forbidden_actions:scenario.forbidden_actions,anti_parroting:true,canon_edit_authority:false,external_gates:true},reasoning_development:{class_id:reasoningClass.id,class_name:reasoningClass.name,skill_id:reasoningClass.skill_id,scenario_id:scenario.id,stage:scenario.stage,required_flags:scenario.required_flags,forbidden_actions:scenario.forbidden_actions,inspectable_checkpoints:true,hidden_chain_of_thought_required:false,single_iq_score:false,human_equivalence_claim:false,profile_not_benchmark:true,authority:'NONE'}}});
  }
  createAdaptiveEpisode(input={}){
    const adaptiveClass=Adaptivity.getClass(input.class_id||input.track_metadata?.adaptive_communication?.class_id);if(!adaptiveClass)throw new Error('valid adaptive communication class required');
    const scenario=Adaptivity.getScenario(input.scenario_id);if(!scenario||scenario.class_id!==adaptiveClass.id)throw new Error('scenario must belong to selected adaptivity class');
    return this.createEpisode({...input,training_tracks:[...new Set(['adaptive_communication','reasoning_development','structured_json','evidence_reasoning','repair','boundary','rooted_intelligence',...(input.training_tracks||[])])],skill_tags:[...new Set([adaptiveClass.skill_id,'adaptivity','semantic-preservation','audience-model','repair',...(input.skill_tags||[])])],track_metadata:{...(input.track_metadata||{}),structured:{contract:{schema:'axm.mirror.adaptive-response/v1',core_delivery_separation:true},rules:{valid_structure_is_not_semantic_equivalence:true,hidden_chain_of_thought_required:false}},rooted_intelligence:{class_id:'embedded-adaptivity-root-check',class_name:'Agency and truth under adaptation',scenario_id:scenario.id,root_ids:['truth','agency','continuity','wisdom'],tension_required:true,required_flags:scenario.required_flags,forbidden_actions:scenario.forbidden_actions,anti_parroting:true,canon_edit_authority:false,external_gates:true},reasoning_development:{class_id:'embedded-adaptive-reasoning',class_name:'Audience-aware translation and semantic verification',skill_id:'adaptive_translation',scenario_id:scenario.id,stage:'CROSS_DOMAIN',required_flags:scenario.required_flags,forbidden_actions:scenario.forbidden_actions,inspectable_checkpoints:true,hidden_chain_of_thought_required:false,single_iq_score:false,human_equivalence_claim:false,profile_not_benchmark:true,authority:'NONE'},adaptive_communication:{class_id:adaptiveClass.id,class_name:adaptiveClass.name,skill_id:adaptiveClass.skill_id,scenario_id:scenario.id,delivery_fields:Adaptivity.DELIVERY_FIELDS,protected_fields:Adaptivity.PROTECTED_FIELDS,semantic_roundtrip_required:true,listener_simulation_required:true,agreement_is_not_success:true,authority:'NONE'}}});
  }
  importModel(input={}){
    const a=actor(input.actor),model=clone(input.model);if(!model||model.schema!==C.SCHEMAS.MODEL)throw new Error('valid token model required');
    if(model.hash!==sha256({...model,hash:undefined}))throw new Error('model hash mismatch');
    return this.store.mutate('MODEL_IMPORTED',a,s=>{this.requireEnabled(s);s.models[model.model_id]=model;if(input.make_active){s.settings.active_model_id=model.model_id;}return model;},{authority:!!input.make_active}).result;
  }
  createBaseline(input={}){
    const a=actor(input.actor);const texts=(input.texts||[]).map(String).filter(Boolean);if(!texts.length)throw new Error('baseline texts required');
    const model=Learner.train({texts,order:Number(input.order)||2,maxVocab:Number(input.max_vocab)||C.MAX_VOCAB,modelId:safeId('model',input.model_id||'baseline')});
    return this.store.mutate('BASELINE_CREATED',a,s=>{this.requireEnabled(s);s.models[model.model_id]=model;if(input.make_active!==false)s.settings.active_model_id=model.model_id;return model;},{authority:input.make_active!==false}).result;
  }
  trainChallenger(input={}){
    const a=actor(input.actor),state=this.store.read();this.requireEnabled(state);
    const candidate=state.candidates[text(input.candidate_id,140)];if(!candidate)throw new Error('candidate not found');if(candidate.status!=='APPROVED'||!candidate.permission.training_allowed)throw new Error('candidate not approved');
    const allEpisodes=Object.values(state.episodes).filter(x=>x.candidate_id===candidate.candidate_id && (!input.episode_ids||input.episode_ids.includes(x.episode_id)));
    if(!allEpisodes.length)throw new Error('no reviewed episodes for candidate');
    const baseline=state.models[text(input.base_model_id||state.settings.active_model_id,160)]||null;
    const growthStage=GrowthPlanner.stage(state);
    const requestedMax=Math.max(1,Number(input.max_episodes)||growthStage.limits.max_episodes_per_cycle);
    const governed=GrowthGovernor.select({episodes:allEpisodes,candidates:state.candidates,maxEpisodes:Math.min(requestedMax,growthStage.limits.max_episodes_per_cycle)});
    const episodes=governed.selected;if(!episodes.length)throw new Error('growth governor selected no eligible episodes');
    const trainingTexts=[];for(const e of episodes){trainingTexts.push((e.input+' '+e.expected).trim());if(e.repair_example)trainingTexts.push(e.repair_example);}
    const heldOutCases=episodes.flatMap(e=>e.held_out_variants||[]);
    const heldOutSuiteHash=sha256(heldOutCases.map(x=>({case_id:x.case_id,input:x.input,expected:x.expected})));
    const maxVocab=Math.min(Math.max(64,Number(input.max_vocab)||growthStage.limits.max_vocab),growthStage.limits.max_vocab);
    const model=Learner.train({texts:trainingTexts,baseModel:baseline,inheritBase:true,order:Number(input.order)||2,maxVocab,modelId:safeId('model','challenger-'+candidate.candidate_id.split(':').pop()+'-'+text(input.branch_id||'a',24))});
    model.training.candidate_id=candidate.candidate_id;model.training.episode_ids=episodes.map(x=>x.episode_id);model.training.source_hash=sha256(trainingTexts);
    model.training.held_out_suite_hash=heldOutSuiteHash;model.training.selection_receipt=governed.selection_receipt;model.training.growth_stage=growthStage.name;model.training.training_tracks=[...new Set(episodes.flatMap(x=>x.training_tracks||['natural_language']))];
    model.hash=sha256({...model,hash:undefined});
    const cycle={schema:'axm.mirror.learning-cycle/v1',cycle_id:safeId('cycle'),candidate_id:candidate.candidate_id,base_model_id:baseline&&baseline.model_id||null,challenger_model_id:model.model_id,stage:growthStage.name,selection_receipt:governed.selection_receipt,held_out_suite_hash:heldOutSuiteHash,training_tracks:model.training.training_tracks,status:'CHALLENGER_TRAINED',created_at:now()};
    cycle.hash=sha256({...cycle,hash:undefined});
    model.growth_cycle=cycle;model.hash=sha256({...model,hash:undefined});return this.store.mutate('CHALLENGER_TRAINED',a,s=>{s.models[model.model_id]=model;s.growth_cycles[cycle.cycle_id]=cycle;return model;}).result;
  }
  protectedProbes(candidate,episodes,trainingTexts,heldOutTexts){
    const roots=['truth before story','no silent rewrite','consent','root'];
    return [
      {probe_id:'probe:approved-candidate',pass:candidate.status==='APPROVED'&&candidate.permission.training_allowed,detail:'candidate must have explicit training permission'},
      {probe_id:'probe:held-out-separation',pass:!heldOutTexts.some(x=>new Set(trainingTexts.map(y=>y.toLowerCase())).has(x.toLowerCase())),detail:'held-out text must not equal training text'},
      {probe_id:'probe:no-tool-authority',pass:true,detail:'Forge never grants tool authority'},
      {probe_id:'probe:no-auto-promotion',pass:true,detail:'promotion remains human-reviewed'},
      {probe_id:'probe:root-change-block',pass:candidate.lesson_type!=='boundary'||!roots.some(r=>candidate.claim.toLowerCase().includes(r)),detail:'root-like boundary edits require a separate canon gate'}
    ];
  }
  evaluateChallenger(input={}){
    const a=actor(input.actor),state=this.store.read();this.requireEnabled(state);
    const challenger=state.models[text(input.challenger_model_id,160)];if(!challenger)throw new Error('challenger model not found');
    const candidate=state.candidates[challenger.training&&challenger.training.candidate_id];if(!candidate)throw new Error('challenger candidate not found');
    const episodes=(challenger.training.episode_ids||[]).map(id=>state.episodes[id]).filter(Boolean);
    const baseline=state.models[text(input.base_model_id||challenger.lineage.base_model_id||'',160)]||null;
    const heldOutCases=episodes.flatMap(e=>(e.held_out_variants||[]).map(x=>({...x,training_tracks:x.training_tracks||e.training_tracks||['natural_language']})));
    const frozenHash=sha256(heldOutCases.map(x=>({case_id:x.case_id,input:x.input,expected:x.expected})));
    if(frozenHash!==challenger.training.held_out_suite_hash)throw new Error('held-out suite changed after training; evaluation refused');
    const trainingTexts=episodes.flatMap(e=>[(e.input+' '+e.expected).trim(),e.repair_example].filter(Boolean));
    const heldOutTexts=heldOutCases.map(x=>(x.input+' '+x.expected).trim());
    const emptyBaseline=baseline||Learner.train({texts:['mirror holds uncertainty until evidence closes the seam'],modelId:'model:empty-baseline',maxVocab:C.MAX_VOCAB});
    const baselineEvaluation={schema:C.SCHEMAS.EVALUATION,evaluation_id:safeId('evaluation','baseline'),model_id:emptyBaseline.model_id,kind:'BASELINE',...Learner.evaluate(emptyBaseline,heldOutCases),suite_hash:frozenHash,created_at:now()};
    const challengerEvaluation={schema:C.SCHEMAS.EVALUATION,evaluation_id:safeId('evaluation','challenger'),model_id:challenger.model_id,kind:'CHALLENGER',...Learner.evaluate(challenger,heldOutCases),suite_hash:frozenHash,created_at:now()};
    const comparison=Learner.compare(baselineEvaluation.summary,challengerEvaluation.summary,baselineEvaluation.cases,challengerEvaluation.cases);
    const trackComparisons={};for(const track of [...new Set(heldOutCases.flatMap(x=>x.training_tracks||[]))]){const cases=heldOutCases.filter(x=>(x.training_tracks||[]).includes(track));const b=Learner.evaluate(emptyBaseline,cases),c=Learner.evaluate(challenger,cases);trackComparisons[track]={case_count:cases.length,baseline:b.summary,challenger:c.summary,comparison:Learner.compare(b.summary,c.summary,b.cases,c.cases)};}
    baselineEvaluation.hash=sha256({...baselineEvaluation,hash:undefined});challengerEvaluation.hash=sha256({...challengerEvaluation,hash:undefined});
    const protectedResults=this.protectedProbes(candidate,episodes,trainingTexts,heldOutTexts);
    protectedResults.push({probe_id:'probe:frozen-suite',pass:frozenHash===challenger.training.held_out_suite_hash,detail:'held-out suite hash must remain frozen from train through evaluation'});
    protectedResults.push({probe_id:'probe:track-evaluation-present',pass:(challenger.training.training_tracks||[]).every(x=>trackComparisons[x]),detail:'every trained track requires held-out track evidence'});
    protectedResults.push({probe_id:'probe:cumulative-lineage',pass:!baseline||challenger.training.inherited_base_counts===true,detail:'challenger must inherit baseline counts rather than relearn from zero'});
    const verdict=SeamCell.inspect({candidate,episodes,baselineEvaluation,challengerEvaluation,comparison,trackComparisons,trainingTexts,heldOutTexts,protectedResults});
    const packet=Promotion.create({candidate,challenger,baseline:baseline||emptyBaseline,baselineEvaluation,challengerEvaluation,seamVerdict:verdict,actor:a});
    packet.comparison_detail=comparison;packet.track_comparisons=trackComparisons;packet.growth_stage=challenger.training.growth_stage;packet.hash=sha256({...packet,hash:undefined});
    return this.store.mutate('CHALLENGER_EVALUATED',a,s=>{s.evaluations[baselineEvaluation.evaluation_id]=baselineEvaluation;s.evaluations[challengerEvaluation.evaluation_id]=challengerEvaluation;s.seam_verdicts[verdict.verdict_id]=verdict;s.promotion_packets[packet.packet_id]=packet;const cycle=Object.values(s.growth_cycles||{}).find(x=>x.challenger_model_id===challenger.model_id);if(cycle){cycle.status='EVALUATED';cycle.promotion_packet_id=packet.packet_id;cycle.comparison=comparison;cycle.hash=sha256({...cycle,hash:undefined});}return{baseline:baselineEvaluation,challenger:challengerEvaluation,comparison,track_comparisons:trackComparisons,protected_results:protectedResults,seam_verdict:verdict,promotion_packet:packet};}).result;
  }
  growthForecast(input={}){
    const state=this.store.read(),counts=this.status().counts;
    const forecast=GrowthPlanner.project({...input,starting_sessions:Number(input.starting_sessions)||Math.max(1,counts.raw_sessions||10)});
    return{forecast,stage:GrowthPlanner.stage(state),truth:{forecast_is_scenario_not_prediction:true,authority_growth_capped_separately:true}};
  }
  reviewPromotion(input={}){
    const a=actor(input.actor),id=text(input.packet_id,180),decision=input.decision;
    return this.store.mutate('PROMOTION_REVIEWED',a,s=>{this.requireEnabled(s);const packet=s.promotion_packets[id];if(!packet)throw new Error('promotion packet not found');Promotion.review(packet,{decision,reviewer:a,reason:input.reason});return packet;},{authority:true}).result;
  }
  applyPromotion(input={}){
    const a=actor(input.actor),id=text(input.packet_id,180);const before=this.store.snapshot('before-promotion');
    return this.store.mutate('PROMOTION_APPLIED',a,s=>{this.requireEnabled(s);const packet=s.promotion_packets[id];if(!packet)throw new Error('promotion packet not found');if(packet.status!=='APPROVED')throw new Error('promotion is not approved');if(packet.recommendation!=='PROMOTE')throw new Error('Seam Cell did not recommend promotion');const prior=s.settings.active_model_id;s.settings.active_model_id=packet.challenger_model_id;packet.status='APPLIED';packet.applied_at=now();packet.applied_by=a;packet.rollback_reference={snapshot_id:before.snapshot_id,previous_model_id:prior};const receipt={application_id:safeId('application'),packet_id:id,previous_model_id:prior,new_model_id:packet.challenger_model_id,snapshot_id:before.snapshot_id,created_at:now()};receipt.hash=sha256({...receipt,hash:undefined});s.applications[receipt.application_id]=receipt;return receipt;},{authority:true}).result;
  }
  rollback(input={}){
    const a=actor(input.actor),applicationId=text(input.application_id,180);
    return this.store.mutate('PROMOTION_ROLLED_BACK',a,s=>{this.requireEnabled(s);const app=s.applications[applicationId];if(!app)throw new Error('application not found');if(app.rolled_back_at)throw new Error('application already rolled back');if(s.settings.active_model_id!==app.new_model_id)throw new Error('active model changed after application; automatic rollback blocked');s.settings.active_model_id=app.previous_model_id;app.rolled_back_at=now();app.rolled_back_by=a;const packet=s.promotion_packets[app.packet_id];if(packet)packet.status='ROLLED_BACK';return app;},{authority:true}).result;
  }
  infer(input={}){
    const state=this.store.read(),model=state.models[text(input.model_id||state.settings.active_model_id,180)];if(!model)throw new Error('no active model');return{model_id:model.model_id,model_hash:model.hash,prompt:text(input.prompt,8000),output:Learner.generate(model,text(input.prompt,8000),{maxTokens:Math.max(1,Math.min(128,Number(input.max_tokens)||32))}),authority:{tool_access:false,apply_access:false}};
  }
  exportMirrorCorePacket(input={}){
    const state=this.store.read(),promotion=state.promotion_packets[text(input.promotion_packet_id,180)];if(!promotion)throw new Error('promotion packet not found');
    const packet={schema_version:C.SCHEMAS.CHANGE_PACKET,packet_id:safeId('packet','learning-forge-'+promotion.packet_id.split(':').pop()),source_system:'mirror-learning-forge-local',target_system:'mirror-core-local',source_snapshot_id:null,target_snapshot_id:null,target_revision:state.revision,authority_revision:state.authority_revision,actor:actor(input.actor),intent:'Propose a reviewed Mirror learning checkpoint promotion',reason:text(input.reason||'Carry a human-reviewed learning result into Mirror Core review.',2000),operations:[{op:'register_learning_checkpoint',model_id:promotion.challenger_model_id,model_hash:promotion.challenger_hash,promotion_packet_id:promotion.packet_id}],affected_entities:[promotion.challenger_model_id],expected_preconditions:[{field:'live_workshop_apply',equals:false},{field:'proposal_first',equals:true}],evidence_refs:[promotion.seam_verdict_id,promotion.packet_id],risk_level:'medium',reversibility:'conditional',requested_permissions:['create_proposal'],approval_requirements:{human_review:true,apply_separate:true},created_at:now(),expires_at:null,status:'DRAFT',validation_results:[{check:'proposal_only',pass:true},{check:'no_live_apply',pass:true}],reviewer_decisions:[],application_receipt:null,rollback_reference:null,extensions:{source_pr:14,source_pr_head:'d427a35f3dafa500d40ff66b86cb464563e4e42b',forge_schema:C.SCHEMAS.PROMOTION}};
    V.assertNoExecutablePayload(packet);return packet;
  }
}
module.exports={MirrorLearningForge,actor};
