#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const Fabric=require('../../shared/capability-fabric/index.js');
const Registry=require('../../shared/capability-fabric/builder-registry.js');
const Admission=require('../../shared/capability-fabric/admission-core.js');
const Host=require('./admission-host.js');

const PILOTS=[
  path.resolve(__dirname,'../capability-recipe-foundry/pilots/axm-capability-recipe-review-closed-json-schema-validator-recipe-pilot-6f0ccc698d7c'),
  path.resolve(__dirname,'../capability-recipe-foundry/pilots/axm-capability-recipe-review-closed-capability-review-skill-recipe-pilot-7586a96b8fe0')
];
let passed=0;
function check(value,label){assert(value,label);passed+=1;process.stdout.write('PASS '+label+'\n');}
function evidenceCases(){return Admission.REVIEW_CASES.map(function(id){return {id:id,verdict:'PASS',evidenceRef:Fabric.digest({case:id,evidence:'focused admission selftest'})};});}
function planInput(inspected,test,review,decision){return {proposal:inspected.proposal,packet:inspected.packet,catalog:Fabric.loadCatalog(),foundryVerification:inspected.verification,testReceipt:test,reviewReceipt:review||null,decision:decision||null};}
function exercisePilot(root){
  const inspected=Host.inspectPacketRoot(root);
  check(inspected.verification.state==='PASS',inspected.packet.target.capabilityKind+' Foundry packet directory verifies without execution');
  const test=Host.runExactTest({packetRoot:root,confirmation:Admission.TEST_CONFIRMATION});
  const expected={proposalDigest:inspected.proposal.proposalDigest,builderId:inspected.builder.id,builderDigest:inspected.builder.implementationDigest,capabilityKind:inspected.builder.capabilityKind,packetDigest:inspected.packet.packetDigest};
  check(test.state==='PASS'&&Admission.verifyTestReceipt(test,expected),inspected.packet.target.capabilityKind+' trusted builder and generated-capability test receipt verifies');
  const first=Admission.buildPlan(planInput(inspected,test));
  check(first.state==='AWAITING_SOURCE_REVIEW'&&Admission.verifyPlan(first).state==='PASS',inspected.packet.target.capabilityKind+' technical admission stops at source review');
  const review=Admission.buildReviewReceipt(Object.assign({},expected,{testReceiptDigest:test.receiptDigest,reviewer:'Codex source reviewer',confirmation:Admission.REVIEW_CONFIRMATION,cases:evidenceCases()}));
  check(review.state==='PASS'&&Admission.verifyReviewReceipt(review,Object.assign({},expected,{testReceiptDigest:test.receiptDigest})),inspected.packet.target.capabilityKind+' exact nine-case source review receipt verifies');
  const second=Admission.buildPlan(planInput(inspected,test,review));
  check(second.state==='AWAITING_MIKE_DECISION'&&Admission.verifyPlan(second).state==='PASS',inspected.packet.target.capabilityKind+' reviewed admission stops at Mike decision');
  const decisionInput={admissionDigest:second.admissionDigest,proposalDigest:second.proposalRef.proposalDigest,builderDigest:second.proposalRef.builderDigest,baseCatalogDigest:second.baseCatalogDigest,reviewReceiptDigest:review.receiptDigest,reviewer:'Mike Tobi',confirmation:Admission.DECISION_CONFIRMATION};
  const wrong=Admission.buildDecision(Object.assign({},decisionInput,{reviewer:'not-mike'}));
  check(Admission.buildPlan(planInput(inspected,test,review,wrong)).state==='AWAITING_MIKE_DECISION',inspected.packet.target.capabilityKind+' non-Mike decision cannot open merge readiness');
  const decision=Admission.buildDecision(decisionInput),ready=Admission.buildPlan(planInput(inspected,test,review,decision));
  check(ready.state==='READY_FOR_REVIEWED_MERGE'&&Admission.verifyPlan(ready).state==='PASS',inspected.packet.target.capabilityKind+' exact reviewed decision produces merge-only readiness');
  check(ready.proposedRecipe.builderDigest===inspected.builder.implementationDigest&&ready.proposedCatalog.recipes.length===4&&ready.proposedRegistry.entries.find(function(row){return row.id===inspected.builder.id;}).status===Registry.ACTIVE,inspected.packet.target.capabilityKind+' plan binds exact prospective recipe, catalog, and registry');
  const one=Registry.compileReviewCandidate(inspected.builder.id,inspected.builder.implementationDigest,inspected.proposal.recipe.exampleRequest.parameters),two=Registry.compileReviewCandidate(inspected.builder.id,inspected.builder.implementationDigest,inspected.proposal.recipe.exampleRequest.parameters);
  check(Fabric.canonicalJson(one)===Fabric.canonicalJson(two)&&Fabric.validateCompiledArtifact(inspected.proposal.recipe,one).ok,inspected.packet.target.capabilityKind+' review-candidate builder is deterministic and kind-valid');
  const tampered=Fabric.clone(test);tampered.builderDigest=Fabric.digest('tampered');
  check(!Admission.verifyTestReceipt(tampered,expected),inspected.packet.target.capabilityKind+' rehashed-or-unsealed test drift is refused');
}
function main(){
  const inventory=Registry.inventory();
  check(Registry.activeIds().length===3&&Registry.reviewCandidateIds().length===2,'registry separates three active builders from two review candidates');
  check(inventory.registryDigest===Registry.inventory().registryDigest,'builder registry digest is deterministic');
  PILOTS.forEach(exercisePilot);
  check(Registry.activeIds().length===3&&Fabric.loadCatalog().recipes.length===3,'admission planning performs no actual activation or catalog mutation');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'axm-admission-tamper-'));
  try{fs.cpSync(PILOTS[0],temp,{recursive:true});fs.appendFileSync(path.join(temp,'builder-contribution.js'),'\n');const result=Host.inspectPacketRoot(temp);check(result.verification.state==='FAIL','packet source-byte tampering fails host verification');}
  finally{fs.rmSync(temp,{recursive:true,force:true});}
  process.stdout.write('Capability Fabric admission selftest PASS · '+passed+' checks\n');
}
if(require.main===module){try{main();}catch(error){process.stderr.write('Capability Fabric admission selftest FAIL\n'+Host.publicError(error)+'\n');process.exitCode=1;}}
module.exports={main:main};
