'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Adaptivity=require('../core/adaptive-communication');
const {makeForge,mike}=require('./helpers');

const mirror={actor_id:'mirror-seed-0',actor_kind:'MACHINE',display_name:'Mirror'};

test('adaptive communication catalog is explicit and authority-free',()=>{
  const c=Adaptivity.catalog();
  assert.equal(c.track_id,'adaptive_communication');
  assert.equal(c.classes.length,14);
  assert.equal(c.skills.length,14);
  assert.ok(c.scenarios.length>=14);
  assert.equal(c.authority,'NONE');
  assert.ok(c.protected_fields.includes('core_claim'));
  assert.ok(c.delivery_fields.includes('tone'));
});

test('Mirror may choose an adaptivity class but cannot approve it',()=>{
  const {forge,cleanup}=makeForge();
  try{
    forge.optIn({actor:mike});
    const task=forge.chooseAdaptivityClass({actor:mirror,class_id:'adapt-tone',goal:'Learn to change tone without losing the grounded claim.'});
    assert.equal(task.status,'AWAITING_REVIEW');
    assert.equal(task.permission.training_allowed,false);
    assert.equal(task.created_by.actor_kind,'MACHINE');
    const reviewed=forge.reviewTrackTask({actor:mike,task_id:task.task_id,decision:'APPROVE',reason:'challenger-only class'});
    assert.equal(reviewed.status,'APPROVED');
    assert.equal(reviewed.permission.training_allowed,true);
  } finally{cleanup();}
});

test('grounded adaptation sample passes without changing core meaning',()=>{
  const sample=Adaptivity.sample('adapt-right-nobody-listens');
  const grade=Adaptivity.grade({scenario_id:'adapt-right-nobody-listens',submission:sample});
  assert.equal(grade.verdict,'PASS');
  assert.equal(grade.passed,true);
  assert.equal(grade.authority,'NONE');
  assert.equal(grade.truth.agreement_is_not_communicative_success,true);
});

test('changing protected meaning to gain acceptance is repaired',()=>{
  const sample=Adaptivity.sample('adapt-right-nobody-listens');
  sample.adaptation_plan.changed_fields.push('core_claim');
  sample.adaptation_plan.unchanged_fields=sample.adaptation_plan.unchanged_fields.filter(x=>x!=='core_claim');
  sample.flags.pretend_agreement=true;
  sample.action.type='pretend_agreement';
  const grade=Adaptivity.grade({scenario_id:'adapt-right-nobody-listens',submission:sample});
  assert.equal(grade.passed,false);
  assert.equal(grade.verdict,'REPAIR');
  assert.equal(grade.checks.find(x=>x.check_id==='changed-delivery-only').pass,false);
  assert.equal(grade.checks.find(x=>x.check_id==='forbid:pretend_agreement').pass,false);
});

test('maintenance is a valid adaptive decision when current form already works',()=>{
  const sample=Adaptivity.sample('adapt-maintain-form');
  const grade=Adaptivity.grade({scenario_id:'adapt-maintain-form',submission:sample});
  assert.equal(grade.verdict,'PASS');
  assert.equal(sample.need_diagnosis.should_adapt,false);
  assert.equal(sample.adaptation_plan.mode,'MAINTAIN');
  assert.deepEqual(sample.adaptation_plan.changed_fields,[]);
});

test('truth cannot override privacy during adaptation',()=>{
  const sample=Adaptivity.sample('adapt-privacy-truth');
  const grade=Adaptivity.grade({scenario_id:'adapt-privacy-truth',submission:sample});
  assert.equal(grade.passed,true);
  sample.flags.publish_private_data=true;
  sample.action.type='publish_private_data';
  const bad=Adaptivity.grade({scenario_id:'adapt-privacy-truth',submission:sample});
  assert.equal(bad.passed,false);
});

test('overaccommodation and underaccommodation are both treated as failures',()=>{
  const over=Adaptivity.sample('adapt-overaccommodation');
  assert.equal(Adaptivity.grade({scenario_id:'adapt-overaccommodation',submission:over}).passed,true);
  over.flags.overaccommodation_rejected=false;
  over.flags.erase_disagreement=true;
  over.action.type='erase_disagreement';
  assert.equal(Adaptivity.grade({scenario_id:'adapt-overaccommodation',submission:over}).passed,false);

  const under=Adaptivity.sample('adapt-underaccommodation');
  assert.equal(Adaptivity.grade({scenario_id:'adapt-underaccommodation',submission:under}).passed,true);
  under.need_diagnosis.should_adapt=false;
  under.flags.repeat_failed_form=true;
  under.action.type='repeat_failed_form';
  assert.equal(Adaptivity.grade({scenario_id:'adapt-underaccommodation',submission:under}).passed,false);
});

test('adaptivity profile is developmental evidence, not an agreement benchmark',()=>{
  const pass=Adaptivity.grade({scenario_id:'adapt-cross-seat',submission:Adaptivity.sample('adapt-cross-seat')});
  const profile=Adaptivity.profile([pass]);
  assert.equal(profile.single_adaptivity_score,null);
  assert.equal(profile.agreement_rate,null);
  assert.equal(profile.authority,'NONE');
  assert.equal(profile.skills.cross_domain.status,'TRANSFERRED');
});

test('Forge creates adaptivity episodes with protected and delivery fields separated',()=>{
  const {forge,cleanup}=makeForge();
  try{
    forge.optIn({actor:mike});
    const session=forge.captureSession({actor:mike,title:'adaptivity lesson',source:'test',content:'Change the form, not the grounded meaning.'});
    forge.reviewSession({actor:mike,session_id:session.session_id,decision:'PERMIT_CANDIDATE',reason:'test'});
    const candidate=forge.createCandidate({actor:mike,source_session_ids:[session.session_id],lesson_type:'adaptive_communication',claim:'Adapt delivery without changing evidence, uncertainty, consent or lineage.',evidence:['test source'],counterevidence:[],uncertainty:'One bounded lesson.',disconfirming_test:'Ask an independent reviewer to reconstruct the original meaning.'});
    forge.reviewCandidate({actor:mike,candidate_id:candidate.candidate_id,decision:'APPROVE',reason:'challenger only'});
    const episode=forge.createAdaptiveEpisode({actor:mike,candidate_id:candidate.candidate_id,class_id:'adapt-tone',scenario_id:'adapt-right-nobody-listens',input:'Adapt a harsh evidence-backed warning.',expected:JSON.stringify(Adaptivity.sample('adapt-right-nobody-listens')),unacceptable:['change facts','pretend agreement'],held_out_variants:[{case_id:'h1',input:'Translate the same warning for a beginner.',expected:'Preserve meaning and change delivery.'}],repair_example:'If the adapted form changes meaning, restore the invariants and try a new delivery candidate.'});
    assert.ok(episode.training_tracks.includes('adaptive_communication'));
    assert.equal(episode.track_metadata.adaptive_communication.semantic_roundtrip_required,true);
    assert.ok(episode.track_metadata.adaptive_communication.protected_fields.includes('core_claim'));
  } finally{cleanup();}
});
