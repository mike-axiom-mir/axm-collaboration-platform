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

const REVIEWED_PILOTS=[
  path.resolve(__dirname,'../capability-recipe-foundry/pilots/axm-capability-recipe-review-closed-json-schema-validator-recipe-pilot-6f0ccc698d7c'),
  path.resolve(__dirname,'../capability-recipe-foundry/pilots/axm-capability-recipe-review-closed-capability-review-skill-recipe-pilot-7586a96b8fe0')
];
let passed=0;
function check(value,label){assert(value,label);passed+=1;process.stdout.write('PASS '+label+'\n');}
function evidenceCases(){return Admission.REVIEW_CASES.map(function(id){return {id:id,verdict:'PASS',evidenceRef:Fabric.digest({case:id,evidence:'focused admission receipt selftest'})};});}
function byId(checks,id){return checks.find(function(row){return row.id===id;});}

function exerciseReviewedPilot(root){
  const inspected=Host.inspectPacketRoot(root),kind=inspected.packet.target.capabilityKind;
  check(inspected.verification.state==='FAIL'&&byId(inspected.verification.checks,'registered-review-candidate').pass===false,kind+' historical packet cannot re-enter admission after activation');
  check(inspected.verification.checks.filter(function(row){return row.id!=='registered-review-candidate';}).every(function(row){return row.pass;}),kind+' historical packet retains exact packet, proposal, receipt, and authority bindings');
  const builder=Registry.describe(inspected.packet.target.builderId),recipe=Fabric.loadCatalog().recipes.find(function(row){return row.id===inspected.packet.target.recipeId;});
  check(builder.status===Registry.ACTIVE&&recipe&&recipe.builderDigest===builder.implementationDigest,kind+' reviewed builder and recipe remain exact and active');
  const one=Registry.compileActive(builder.id,builder.implementationDigest,inspected.proposal.recipe.exampleRequest.parameters),two=Registry.compileActive(builder.id,builder.implementationDigest,inspected.proposal.recipe.exampleRequest.parameters);
  check(Fabric.canonicalJson(one)===Fabric.canonicalJson(two)&&Fabric.validateCompiledArtifact(inspected.proposal.recipe,one).ok,kind+' active builder remains deterministic and kind-valid');
  const refused=Host.runExactTest({packetRoot:root,confirmation:Admission.TEST_CONFIRMATION});
  check(refused.state==='FAIL'&&refused.sourceExecuted===false&&refused.generatedCapabilityExecuted===false,kind+' historical packet cannot trigger the review-candidate execution route');
  const held=Admission.buildPlan({proposal:inspected.proposal,packet:inspected.packet,catalog:Fabric.loadCatalog(),foundryVerification:inspected.verification,testReceipt:refused,reviewReceipt:null,decision:null});
  check(held.state==='HELD'&&held.holds.some(function(row){return row.code==='RECIPE_ID_ALREADY_ACTIVE';})&&held.holds.some(function(row){return row.code==='BUILDER_REVIEW_CANDIDATE_MISMATCH';})&&Admission.verifyPlan(held).state==='PASS',kind+' replay becomes a typed no-effect admission hold');
}

function exerciseReceiptContracts(){
  const expected={
    proposalDigest:Fabric.digest('future proposal'),
    builderId:'future-review-builder-v1',
    builderDigest:Fabric.digest('future builder'),
    capabilityKind:'SKILL',
    packetDigest:Fabric.digest('future packet')
  };
  const test=Admission.buildTestReceipt(Object.assign({},expected,{state:'PASS',sourceExecuted:true,generatedCapabilityExecuted:true,checks:[{id:'exact-test',pass:true}],outputDigest:Fabric.digest('PASS output')}));
  check(Admission.verifyTestReceipt(test,expected),'future-candidate trusted-test receipt contract seals and verifies');
  const testDrift=Fabric.clone(test);testDrift.outputDigest=Fabric.digest('drift');
  check(!Admission.verifyTestReceipt(testDrift,expected),'test receipt byte drift is refused');
  const reviewExpected=Object.assign({},expected,{testReceiptDigest:test.receiptDigest});
  const review=Admission.buildReviewReceipt(Object.assign({},reviewExpected,{reviewer:'Codex source reviewer',confirmation:Admission.REVIEW_CONFIRMATION,cases:evidenceCases()}));
  check(Admission.verifyReviewReceipt(review,reviewExpected),'exact nine-case source-review receipt contract seals and verifies');
  const incomplete=Admission.buildReviewReceipt(Object.assign({},reviewExpected,{reviewer:'Codex source reviewer',confirmation:Admission.REVIEW_CONFIRMATION,cases:evidenceCases().slice(1)}));
  check(incomplete.state==='FAIL'&&!Admission.verifyReviewReceipt(incomplete,reviewExpected),'missing source-review evidence case is refused');
  const decisionExpected={admissionDigest:Fabric.digest('future admission'),proposalDigest:expected.proposalDigest,builderDigest:expected.builderDigest,baseCatalogDigest:Fabric.loadCatalog().catalogDigest,reviewReceiptDigest:review.receiptDigest};
  const wrong=Admission.buildDecision(Object.assign({},decisionExpected,{reviewer:'not-mike',confirmation:Admission.DECISION_CONFIRMATION}));
  check(!Admission.verifyDecision(wrong,decisionExpected),'non-Mike decision cannot authorize reviewed merge readiness');
  const decision=Admission.buildDecision(Object.assign({},decisionExpected,{reviewer:'Mike Tobi',confirmation:Admission.DECISION_CONFIRMATION}));
  check(Admission.verifyDecision(decision,decisionExpected),'exact Mike reviewed-merge decision contract seals and verifies');
  const decisionDrift=Fabric.clone(decision);decisionDrift.canon=true;
  check(!Admission.verifyDecision(decisionDrift,decisionExpected),'decision byte drift cannot grant CANON authority');
}

function main(){
  const inventory=Registry.inventory(),catalogBefore=Fabric.loadCatalog();
  check(Registry.activeIds().length===5&&Registry.reviewCandidateIds().length===0,'registry contains five reviewed active builders and no pending candidate');
  check(inventory.registryDigest===Registry.inventory().registryDigest,'builder registry digest is deterministic');
  REVIEWED_PILOTS.forEach(exerciseReviewedPilot);
  exerciseReceiptContracts();
  check(Fabric.canonicalJson(Fabric.loadCatalog())===Fabric.canonicalJson(catalogBefore)&&Registry.activeIds().length===5,'admission replay and receipt tests perform no activation or catalog mutation');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'axm-admission-tamper-'));
  try{
    fs.cpSync(REVIEWED_PILOTS[0],temp,{recursive:true});
    fs.appendFileSync(path.join(temp,'builder-contribution.js'),'\n');
    const result=Host.inspectPacketRoot(temp);
    check(result.verification.state==='FAIL'&&byId(result.verification.checks,'packet-file-bytes-and-digests').pass===false,'packet source-byte tampering fails independently of lifecycle status');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
  process.stdout.write('Capability Fabric admission selftest PASS · '+passed+' checks\n');
}
if(require.main===module){try{main();}catch(error){process.stderr.write('Capability Fabric admission selftest FAIL\n'+Host.publicError(error)+'\n');process.exitCode=1;}}
module.exports={main:main};
