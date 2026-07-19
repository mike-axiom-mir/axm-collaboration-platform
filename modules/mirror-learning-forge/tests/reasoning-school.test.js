'use strict';
const test=require('node:test'),assert=require('node:assert');
const fs=require('fs'),path=require('path');
const Reasoning=require('../core/reasoning-school');
const {makeForge,mike}=require('./helpers');

function setupCandidate(forge){
  forge.optIn({actor:mike});
  const session=forge.captureSession({actor:mike,title:'reasoning candidate',source:'test',content:'Decompose problems, compare paths, calibrate confidence and preserve repair.'});
  forge.reviewSession({actor:mike,session_id:session.session_id,decision:'PERMIT_CANDIDATE',reason:'test'});
  const candidate=forge.createCandidate({actor:mike,source_session_ids:[session.session_id],lesson_type:'reasoning_development',claim:'Reason through inspectable state, path comparison, verification and repair.',evidence:['test'],counterevidence:['Structure can be imitated.'],uncertainty:'Bounded test only.',disconfirming_test:'Use an unseen cross-domain case.'});
  forge.reviewCandidate({actor:mike,candidate_id:candidate.candidate_id,decision:'APPROVE',reason:'challenger only'});return candidate;
}

test('catalog exposes 18 skills and six developmental stages without IQ ranking',()=>{const c=Reasoning.catalog();assert.equal(c.skills.length,18);assert.equal(c.stages.length,6);assert.equal(c.assessment.single_iq_score,false);assert.equal(c.assessment.hidden_chain_of_thought_required,false);});

test('Mirror may choose a reasoning class but cannot approve it',()=>{const {forge,cleanup}=makeForge();try{forge.optIn({actor:mike});const task=forge.chooseReasoningClass({class_id:'reason-decomposition'});assert.equal(task.status,'AWAITING_REVIEW');assert.equal(task.permission.training_allowed,false);assert.equal(task.contract.self_approval,false);assert.equal(task.contract.authority,'NONE');}finally{cleanup();}});

test('reasoning sample passes as bounded receipt',()=>{const sample=Reasoning.sample('reason-decompose-runtime');const grade=Reasoning.grade({scenario_id:'reason-decompose-runtime',submission:sample});assert.equal(grade.verdict,'PASS');assert.equal(grade.development_evidence.single_iq_score,null);assert.equal(grade.authority,'NONE');});

test('open seam with fake certainty is held',()=>{const sample=Reasoning.sample('reason-confidence-seam');sample.confidence.after=.99;const grade=Reasoning.grade({scenario_id:'reason-confidence-seam',submission:sample});assert.notEqual(grade.verdict,'PASS');assert.ok(grade.checks.some(x=>x.check_id==='calibration-open-seam'&&!x.pass));});

test('self-granted tool authority triggers repair',()=>{const sample=Reasoning.sample('reason-tool-calculator');sample.tool_choice.authority_requested=true;const grade=Reasoning.grade({scenario_id:'reason-tool-calculator',submission:sample});assert.equal(grade.verdict,'REPAIR');assert.ok(grade.checks.some(x=>x.check_id==='tool-authority'&&!x.pass));});

test('raw experience cannot auto-promote into semantic truth',()=>{const sample=Reasoning.sample('reason-memory-route');sample.memory_policy.raw_session_auto_promotes=true;const grade=Reasoning.grade({scenario_id:'reason-memory-route',submission:sample});assert.equal(grade.verdict,'REPAIR');});

test('a verified verdict without evidence-bearing check is refused',()=>{const sample=Reasoning.sample('reason-evidence-conflict');sample.verdict='VERIFIED';sample.verification_checks=sample.verification_checks.map(x=>({...x,evidence_ref:null,status:'HOLD'}));const grade=Reasoning.grade({scenario_id:'reason-evidence-conflict',submission:sample});assert.equal(grade.verdict,'REPAIR');});

test('planning class keeps promotion review last',()=>{const sample=Reasoning.sample('reason-plan-challenger');const pass=Reasoning.grade({scenario_id:'reason-plan-challenger',submission:sample});assert.equal(pass.verdict,'PASS');sample.sequence=['freeze curriculum','promotion review','train challenger'];const fail=Reasoning.grade({scenario_id:'reason-plan-challenger',submission:sample});assert.notEqual(fail.verdict,'PASS');});

test('reasoning episode joins evidence repair boundary roots and JSON tracks',()=>{const {forge,cleanup}=makeForge();try{const candidate=setupCandidate(forge);const e=forge.createReasoningEpisode({actor:mike,candidate_id:candidate.candidate_id,class_id:'reason-decomposition',scenario_id:'reason-decompose-runtime',input:'Decompose this.',expected:JSON.stringify(Reasoning.sample('reason-decompose-runtime')),held_out_variants:[{case_id:'r1',input:'Phone cannot connect.',expected:'Split network checks.'},{case_id:'r2',input:'Art output is wrong.',expected:'Split packet, pixel and screenshot checks.'}]});for(const id of ['reasoning_development','structured_json','evidence_reasoning','repair','boundary','rooted_intelligence'])assert.ok(e.training_tracks.includes(id));assert.equal(e.track_metadata.reasoning_development.single_iq_score,false);}finally{cleanup();}});

test('reasoning track receives separate held-out challenger comparison',()=>{const {forge,cleanup}=makeForge();try{const c=setupCandidate(forge);forge.createReasoningEpisode({actor:mike,candidate_id:c.candidate_id,class_id:'reason-decomposition',scenario_id:'reason-decompose-runtime',input:'Decompose runtime failure.',expected:JSON.stringify(Reasoning.sample('reason-decompose-runtime')),held_out_variants:[{case_id:'rh1',input:'Phone route fails.',expected:'Check host binding and route.'},{case_id:'rh2',input:'Training regresses.',expected:'Compare baseline and challenger metrics.'}]});const b=forge.createBaseline({actor:mike,texts:['mirror decomposes problems and preserves evidence'],make_active:true});const ch=forge.trainChallenger({actor:mike,candidate_id:c.candidate_id,base_model_id:b.model_id});const result=forge.evaluateChallenger({actor:mike,challenger_model_id:ch.model_id,base_model_id:b.model_id});assert.ok(result.track_comparisons.reasoning_development);assert.equal(result.track_comparisons.reasoning_development.case_count,2);}finally{cleanup();}});

test('development profile has no global score or human comparison',()=>{const sample=Reasoning.sample('reason-decompose-runtime');const g=Reasoning.grade({scenario_id:'reason-decompose-runtime',submission:sample});const p=Reasoning.profile([g]);assert.equal(p.single_iq_score,null);assert.equal(p.human_equivalence,null);assert.equal(p.ranking,null);assert.equal(p.skills.decomposition.status,'DEMONSTRATED');});

test('cross-domain pass becomes transferred evidence',()=>{const g=Reasoning.grade({scenario_id:'reason-analogy-boundary',submission:Reasoning.sample('reason-analogy-boundary')});const p=Reasoning.profile([g]);assert.equal(p.skills.analogy_transfer.status,'TRANSFERRED');});

test('failure followed by transferred pass becomes repair-proven',()=>{const bad=Reasoning.grade({scenario_id:'reason-analogy-boundary',submission:{}});bad.created_at='2026-01-01T00:00:00.000Z';const good=Reasoning.grade({scenario_id:'reason-analogy-boundary',submission:Reasoning.sample('reason-analogy-boundary')});good.created_at='2026-01-02T00:00:00.000Z';const p=Reasoning.profile([bad,good]);assert.equal(p.skills.analogy_transfer.status,'REPAIR_PROVEN');});

test('hidden private chain is not demanded or accepted as proof',()=>{const sample=Reasoning.sample('reason-unknown-assumption');sample.hidden_chain_of_thought_provided=true;const grade=Reasoning.grade({scenario_id:'reason-unknown-assumption',submission:sample});assert.notEqual(grade.verdict,'PASS');assert.ok(grade.checks.some(x=>x.check_id==='no-hidden-chain-demand'&&!x.pass));});

test('reasoning fixtures and curriculum are packaged',()=>{const root=path.resolve(__dirname,'..');for(const rel of ['curricula/reasoning-development-v1.json','fixtures/reasoning/adversarial-cases.json','fixtures/reasoning/held-out-cases.json','schemas/reasoning-response.schema.json','schemas/reasoning-grade.schema.json','schemas/reasoning-profile.schema.json'])assert.ok(fs.existsSync(path.join(root,rel)),rel);const held=JSON.parse(fs.readFileSync(path.join(root,'fixtures/reasoning/held-out-cases.json'),'utf8'));assert.equal(held.frozen,true);assert.equal(held.cases.length,18);});

test('reasoning profile API reads stored grades without authority mutation',()=>{const {forge,cleanup}=makeForge();try{forge.optIn({actor:mike});const before=forge.store.read().authority_revision;forge.gradeReasoning({actor:mike,scenario_id:'reason-decompose-runtime',submission:Reasoning.sample('reason-decompose-runtime')});const p=forge.reasoningProfile();assert.equal(p.skills.decomposition.status,'DEMONSTRATED');assert.equal(forge.store.read().authority_revision,before);}finally{cleanup();}});

test('unknown reasoning class or scenario is refused',()=>{assert.throws(()=>Reasoning.makeTrackTask({class_id:'reason-power'}),/known reasoning class/);assert.throws(()=>Reasoning.grade({scenario_id:'not-real',submission:{}}),/known reasoning scenario/);});

test('Forge status exposes non-benchmark reasoning boundaries',()=>{const {forge,cleanup}=makeForge();try{const s=forge.status();assert.equal(s.boundaries.reasoning_school,true);assert.equal(s.boundaries.single_iq_score,false);assert.equal(s.boundaries.hidden_chain_of_thought_required,false);assert.equal(s.boundaries.reasoning_authority_from_grade,false);}finally{cleanup();}});
