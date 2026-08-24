'use strict';
const assert=require('assert');
const fabric=require('./machine-template-fabric.js');
const miner=require('./template-pattern-miner.js');
const router=require('./template-fast-router.js');
const banks=fabric.all();
assert.strictEqual(banks.length,102);
assert.strictEqual(new Set(banks.map(b=>b.bankSha256)).size,102);
let templates=0,skeletons=0;const templateIds=new Set();
for(const b of banks){
  assert.strictEqual(b.lanes.verifiedVault.templateCount,12,b.languageId);
  assert.strictEqual(b.lanes.verifiedVault.templates.length,12,b.languageId);
  assert.strictEqual(b.structuralSkeletons.length,8,b.languageId);
  assert.strictEqual(b.lanes.patternNursery.automaticPromotion,false);
  assert.strictEqual(b.policy.frequencyIsNotCorrectness,true);
  assert.strictEqual(b.authority.workspaceMutation,false);
  for(const t of b.lanes.verifiedVault.templates){templates++;assert(!templateIds.has(t.id));templateIds.add(t.id);assert.strictEqual(t.authority,'NONE');assert.strictEqual(t.evidence.doesNotClaimSourceCorrectness,true);assert(t.steps.length>0);assert(t.holes.length>=4);}
  for(const s of b.structuralSkeletons){skeletons++;assert.strictEqual(s.authority,'NONE');assert.strictEqual(s.renderPolicy,'NO_SOURCE_EMIT_WITHOUT_LANGUAGE_RENDERER_OR_AI_PROPOSAL');}
}
assert.strictEqual(templates,1224);assert.strictEqual(skeletons,816);
const snap=fabric.snapshot();assert.strictEqual(snap.verifiedTemplateCount,1224);assert.strictEqual(snap.skeletonCount,816);assert(/^[a-f0-9]{64}$/.test(snap.snapshotSha256));

const samples=[
 {languageId:'rust',intent:'error-handling',patternKind:'EDIT_PATTERN',projectDigest:'p1',shape:['match','Result','Err','return'],contextTags:['result-path'],verifierEvidence:['cargo-check']},
 {languageId:'rust',intent:'error-handling',patternKind:'EDIT_PATTERN',projectDigest:'p2',shape:['match','Result','Err','propagate'],contextTags:['result-path'],verifierEvidence:['cargo-check']},
 {languageId:'rust',intent:'error-handling',patternKind:'EDIT_PATTERN',projectDigest:'p3',shape:['match','Result','Err','map-error'],contextTags:['result-path'],verifierEvidence:['cargo-test']},
 {languageId:'rust',intent:'singleton',patternKind:'STRUCTURAL',projectDigest:'p1',shape:['unsafe','block']},
];
const mined=miner.mine(samples);assert.strictEqual(mined.candidateCount,1);const candidate=mined.candidates[0];assert.strictEqual(candidate.languageId,'rust');assert.strictEqual(candidate.support,3);assert.strictEqual(candidate.projectDiversity,3);assert(candidate.holes.length>=1);assert.strictEqual(candidate.automaticPromotion,false);
let admission=miner.prepareAdmission(candidate,['STRUCTURAL_PARSE_PASS']);assert.strictEqual(admission.result,'ADMISSION_HELD');
admission=miner.prepareAdmission(candidate,['STRUCTURAL_PARSE_PASS','NEGATIVE_FIXTURE_PASS','EXPLICIT_REVIEW_DECISION']);assert.strictEqual(admission.result,'ADMISSION_REVIEW_READY');assert.strictEqual(admission.automaticPromotion,false);

const machine=router.select({languageId:'rust',intent:'refactor',signals:['borrow semantics','unsafe boundaries'],mode:'MACHINE',topN:3});
const ai=router.select({languageId:'rust',intent:'refactor',signals:['borrow semantics','unsafe boundaries'],mode:'AI',topN:3});
assert.strictEqual(machine.result,'TEMPLATES_SELECTED');assert.strictEqual(ai.result,'TEMPLATES_SELECTED');assert.strictEqual(machine.selected[0].templateId,ai.selected[0].templateId);assert.strictEqual(machine.selected[0].capsuleClass,'DETERMINISTIC_MACHINE_TEMPLATE_CAPSULE');assert.strictEqual(ai.selected[0].capsuleClass,'COMPACT_AI_TEMPLATE_CAPSULE');
const tid=machine.selected[0].templateId;
let inst=router.instantiate({languageId:'rust',templateId:tid,bindings:{}});assert.strictEqual(inst.result,'TEMPLATE_BINDINGS_INCOMPLETE');
inst=router.instantiate({languageId:'rust',templateId:tid,bindings:{H1:'item',H2:'Result<T,E>'}});assert.strictEqual(inst.result,'TEMPLATE_INSTANCE_READY_RENDER_HELD');assert.strictEqual(inst.sourceCode,null);assert.strictEqual(inst.toolExecution,false);assert.strictEqual(inst.workspaceMutation,false);
inst=router.instantiate({languageId:'rust',templateId:tid,bindings:{H1:'item',H2:'Result<T,E>'},renderAdapter:{id:'rust.renderer.test',digest:'abc'}});assert.strictEqual(inst.result,'TEMPLATE_INSTANCE_READY_RENDERER_BOUND_EXECUTION_HELD');
const combined=router.mineAndSelect({samples,query:{languageId:'rust',intent:'error-handling',signals:['result-path'],mode:'AI',topN:4}});assert.strictEqual(combined.mining.candidateCount,1);assert(combined.selection.selected.some(x=>x.lane==='PATTERN_NURSERY'));
const unknown=router.select({languageId:'not-a-language'});assert.strictEqual(unknown.result,'UNKNOWN_LANGUAGE');
console.log(JSON.stringify({ok:true,bankCount:banks.length,verifiedTemplateCount:templates,structuralSkeletonCount:skeletons,minedCandidateCount:mined.candidateCount,snapshotSha256:snap.snapshotSha256,aiMachineSharedTopTemplate:tid,authority:'NONE'},null,2));
