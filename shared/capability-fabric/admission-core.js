'use strict';

const Fabric = require('./index.js');
const BuilderRegistry = require('./builder-registry.js');

const VERSION = '1.0.0';
const TEST_RECEIPT_SCHEMA = 'axm.capability-builder-test-receipt/v1';
const REVIEW_RECEIPT_SCHEMA = 'axm.capability-recipe-source-review-receipt/v1';
const DECISION_SCHEMA = 'axm.capability-recipe-admission-decision/v1';
const PLAN_SCHEMA = 'axm.capability-recipe-admission-plan/v1';
const VERIFICATION_SCHEMA = 'axm.capability-recipe-admission-verification/v1';
const TEST_CONFIRMATION = 'RUN EXACT REVIEW CANDIDATE SELFTEST';
const REVIEW_CONFIRMATION = 'I REVIEWED THE EXACT RECIPE SOURCE AND EVIDENCE';
const DECISION_CONFIRMATION = 'ACCEPT EXACT EXPERIMENTAL RECIPE FOR REVIEWED MERGE';
const REVIEW_CASES = Object.freeze(['review-01','review-02','review-03','review-04','review-05','review-06','review-07','review-08','review-09']);
const AUTHORITY = Object.freeze({recipeActivated:false,catalogWritten:false,registryWritten:false,installed:false,registered:false,staged:false,promoted:false,canon:false,foundationChanged:false});

function clone(value){return JSON.parse(Fabric.canonicalJson(value));}
function digest(value){return Fabric.digest(value);}
function without(value,key){const copy=clone(value);delete copy[key];return copy;}
function safeDigest(value){return /^sha256:[a-f0-9]{64}$/.test(String(value||''));}
function safeId(value){return /^[a-z][a-z0-9-]{2,79}$/.test(String(value||''));}
function issue(code,detail){return Object.assign({code:code},detail||{});}
function authorityClosed(value){return value&&Object.keys(AUTHORITY).every(function(key){return value[key]===false;})&&Object.keys(value).length===Object.keys(AUTHORITY).length;}
function receiptDigestValid(value,key){return value&&safeDigest(value[key])&&value[key]===digest(without(value,key));}

function buildTestReceipt(input){
  const stable={
    schema:TEST_RECEIPT_SCHEMA,version:VERSION,state:input.state==='PASS'?'PASS':'FAIL',
    proposalDigest:input.proposalDigest,builderId:String(input.builderId||''),builderDigest:input.builderDigest,
    capabilityKind:String(input.capabilityKind||''),packetDigest:input.packetDigest,
    commandId:'NODE_BUILDER_CONTRIBUTION_SELFTEST',sourceExecuted:input.sourceExecuted===true,generatedCapabilityExecuted:input.generatedCapabilityExecuted===true,
    checks:Array.isArray(input.checks)?input.checks.map(function(row){return {id:String(row.id),pass:row.pass===true};}):[],
    outputDigest:safeDigest(input.outputDigest)?input.outputDigest:null,authority:clone(AUTHORITY)
  };
  return Object.assign({},stable,{receiptDigest:digest(stable)});
}
function verifyTestReceipt(receipt,expected){
  if(!receipt||receipt.schema!==TEST_RECEIPT_SCHEMA||receipt.version!==VERSION||receipt.state!=='PASS'||!receiptDigestValid(receipt,'receiptDigest'))return false;
  if(receipt.proposalDigest!==expected.proposalDigest||receipt.builderId!==expected.builderId||receipt.builderDigest!==expected.builderDigest||receipt.capabilityKind!==expected.capabilityKind||receipt.packetDigest!==expected.packetDigest)return false;
  return receipt.commandId==='NODE_BUILDER_CONTRIBUTION_SELFTEST'&&receipt.sourceExecuted===true&&receipt.generatedCapabilityExecuted===true&&Array.isArray(receipt.checks)&&receipt.checks.length>0&&receipt.checks.every(function(row){return row.pass===true;})&&safeDigest(receipt.outputDigest)&&authorityClosed(receipt.authority);
}

function buildReviewReceipt(input){
  const cases=REVIEW_CASES.map(function(id){const source=(input.cases||[]).find(function(row){return row&&row.id===id;});return {id:id,verdict:source&&source.verdict==='PASS'?'PASS':'FAIL',evidenceRef:source&&safeDigest(source.evidenceRef)?source.evidenceRef:null};});
  const stable={schema:REVIEW_RECEIPT_SCHEMA,version:VERSION,state:cases.every(function(row){return row.verdict==='PASS'&&row.evidenceRef;})?'PASS':'FAIL',proposalDigest:input.proposalDigest,builderId:String(input.builderId||''),builderDigest:input.builderDigest,packetDigest:input.packetDigest,testReceiptDigest:input.testReceiptDigest,reviewer:String(input.reviewer||'').trim().slice(0,120),confirmation:input.confirmation===REVIEW_CONFIRMATION?REVIEW_CONFIRMATION:null,cases:cases,sourceReviewed:true,authority:clone(AUTHORITY)};
  return Object.assign({},stable,{receiptDigest:digest(stable)});
}
function verifyReviewReceipt(receipt,expected){
  if(!receipt||receipt.schema!==REVIEW_RECEIPT_SCHEMA||receipt.version!==VERSION||receipt.state!=='PASS'||!receiptDigestValid(receipt,'receiptDigest'))return false;
  if(receipt.proposalDigest!==expected.proposalDigest||receipt.builderId!==expected.builderId||receipt.builderDigest!==expected.builderDigest||receipt.packetDigest!==expected.packetDigest||receipt.testReceiptDigest!==expected.testReceiptDigest)return false;
  return !!receipt.reviewer&&receipt.confirmation===REVIEW_CONFIRMATION&&receipt.sourceReviewed===true&&Array.isArray(receipt.cases)&&Fabric.canonicalJson(receipt.cases.map(function(row){return row.id;}))===Fabric.canonicalJson(REVIEW_CASES)&&receipt.cases.every(function(row){return row.verdict==='PASS'&&safeDigest(row.evidenceRef);})&&authorityClosed(receipt.authority);
}

function buildDecision(input){
  const stable={schema:DECISION_SCHEMA,version:VERSION,decision:'ACCEPT_EXPERIMENTAL_RECIPE_FOR_REVIEWED_MERGE',admissionDigest:input.admissionDigest,proposalDigest:input.proposalDigest,builderDigest:input.builderDigest,baseCatalogDigest:input.baseCatalogDigest,reviewReceiptDigest:input.reviewReceiptDigest,reviewer:String(input.reviewer||'').trim(),confirmation:input.confirmation===DECISION_CONFIRMATION?DECISION_CONFIRMATION:null,canon:false,authority:clone(AUTHORITY)};
  return Object.assign({},stable,{decisionDigest:digest(stable)});
}
function verifyDecision(decision,expected){
  if(!decision||decision.schema!==DECISION_SCHEMA||decision.version!==VERSION||decision.decision!=='ACCEPT_EXPERIMENTAL_RECIPE_FOR_REVIEWED_MERGE'||!receiptDigestValid(decision,'decisionDigest'))return false;
  return decision.admissionDigest===expected.admissionDigest&&decision.proposalDigest===expected.proposalDigest&&decision.builderDigest===expected.builderDigest&&decision.baseCatalogDigest===expected.baseCatalogDigest&&decision.reviewReceiptDigest===expected.reviewReceiptDigest&&decision.reviewer==='Mike Tobi'&&decision.confirmation===DECISION_CONFIRMATION&&decision.canon===false&&authorityClosed(decision.authority);
}

function activeRecipeFromProposal(proposal,builder){
  const recipe=clone(proposal.recipe);
  recipe.schema=Fabric.RECIPE_SCHEMA;
  recipe.activation=Fabric.ACTIVE_RECIPE;
  recipe.builderDigest=builder.implementationDigest;
  recipe.recipeDigest='';
  recipe.recipeDigest=digest(without(recipe,'recipeDigest'));
  return recipe;
}
function projectedRegistry(builder){
  const inventory=BuilderRegistry.inventory();
  const entries=inventory.entries.map(function(row){const copy=clone(row);if(copy.id===builder.id)copy.status=BuilderRegistry.ACTIVE;return copy;}).sort(function(left,right){return left.id.localeCompare(right.id);});
  const stable={schema:inventory.schema,version:inventory.version,entries:entries};
  return Object.assign({},stable,{registryDigest:digest(stable)});
}
function projectedCatalog(catalog,recipe){
  const recipes=catalog.recipes.concat([recipe]).sort(function(left,right){return left.id.localeCompare(right.id);});
  const stable={schema:catalog.schema,status:catalog.status,activationPolicy:catalog.activationPolicy,recipes:recipes};
  return Object.assign({},stable,{catalogDigest:digest(stable)});
}

function buildPlan(input){
  const holds=[];
  const proposal=input&&input.proposal;
  const packet=input&&input.packet;
  const catalog=input&&input.catalog;
  const foundryVerification=input&&input.foundryVerification;
  const inspection=Fabric.importRecipeProposal(proposal||{});
  if(!inspection.ok||inspection.active!==false)holds.push(issue('PROPOSAL_INVALID'));
  if(!packet||!safeDigest(packet.packetDigest)||!packet.target||!packet.proposalRef||packet.proposalRef.digest!==(proposal&&proposal.proposalDigest)||packet.target.builderId!==(proposal&&proposal.recipe&&proposal.recipe.builderId)||packet.target.capabilityKind!==(proposal&&proposal.recipe&&proposal.recipe.capabilityKind))holds.push(issue('PACKET_PROPOSAL_MISMATCH'));
  if(!foundryVerification||foundryVerification.state!=='PASS'||foundryVerification.packetDigest!==(packet&&packet.packetDigest)||!safeDigest(foundryVerification.verificationDigest))holds.push(issue('FOUNDRY_PACKET_UNVERIFIED'));
  if(!catalog||!Fabric.validateCatalog(catalog).ok)holds.push(issue('BASE_CATALOG_INVALID'));
  else if(catalog.recipes.some(function(row){return proposal&&proposal.recipe&&row.id===proposal.recipe.id;}))holds.push(issue('RECIPE_ID_ALREADY_ACTIVE'));
  const builder=proposal&&proposal.recipe?BuilderRegistry.describe(proposal.recipe.builderId):null;
  if(!builder||builder.status!==BuilderRegistry.REVIEW_CANDIDATE||builder.proposalDigest!==(proposal&&proposal.proposalDigest)||builder.capabilityKind!==(proposal&&proposal.recipe&&proposal.recipe.capabilityKind))holds.push(issue('BUILDER_REVIEW_CANDIDATE_MISMATCH'));
  const expected=builder&&packet?{proposalDigest:proposal.proposalDigest,builderId:builder.id,builderDigest:builder.implementationDigest,capabilityKind:builder.capabilityKind,packetDigest:packet.packetDigest}:null;
  const testVerified=!!expected&&verifyTestReceipt(input.testReceipt,expected);
  if(!testVerified)holds.push(issue('TRUSTED_TEST_RECEIPT_REQUIRED'));
  const proposedRecipe=!holds.some(function(row){return ['PROPOSAL_INVALID','PACKET_PROPOSAL_MISMATCH','BASE_CATALOG_INVALID','RECIPE_ID_ALREADY_ACTIVE','BUILDER_REVIEW_CANDIDATE_MISMATCH'].includes(row.code);})?activeRecipeFromProposal(proposal,builder):null;
  const registryProjection=proposedRecipe?projectedRegistry(builder):null;
  const catalogProjection=proposedRecipe?projectedCatalog(catalog,proposedRecipe):null;
  const admissionStable=proposedRecipe?{proposalDigest:proposal.proposalDigest,packetDigest:packet.packetDigest,builderId:builder.id,builderDigest:builder.implementationDigest,baseCatalogDigest:catalog.catalogDigest,proposedRecipeDigest:proposedRecipe.recipeDigest,proposedCatalogDigest:catalogProjection.catalogDigest,proposedRegistryDigest:registryProjection.registryDigest}:null;
  const admissionDigest=admissionStable?digest(admissionStable):null;
  const reviewExpected=expected&&input.testReceipt?Object.assign({},expected,{testReceiptDigest:input.testReceipt.receiptDigest}):null;
  const reviewVerified=!!reviewExpected&&verifyReviewReceipt(input.reviewReceipt,reviewExpected);
  const decisionExpected=reviewVerified?{admissionDigest:admissionDigest,proposalDigest:proposal.proposalDigest,builderDigest:builder.implementationDigest,baseCatalogDigest:catalog.catalogDigest,reviewReceiptDigest:input.reviewReceipt.receiptDigest}:null;
  const decisionVerified=!!decisionExpected&&verifyDecision(input.decision,decisionExpected);
  let state='HELD',action='NONE';
  const technicalHolds=holds.filter(function(row){return row.code!=='TRUSTED_TEST_RECEIPT_REQUIRED'||!testVerified;});
  if(technicalHolds.length===0){
    if(!reviewVerified){state='AWAITING_SOURCE_REVIEW';action='REVIEW_EXACT_SOURCE_AND_EVIDENCE';}
    else if(!decisionVerified){state='AWAITING_MIKE_DECISION';action='REVIEW_EXACT_ADMISSION_DIFF';}
    else {state='READY_FOR_REVIEWED_MERGE';action='MERGE_EXACT_REGISTRY_AND_CATALOG_DIFF';}
  }
  const stable={schema:PLAN_SCHEMA,version:VERSION,state:state,action:action,admissionDigest:admissionDigest,proposalRef:expected?{recipeId:proposal.recipe.id,proposalDigest:proposal.proposalDigest,builderId:builder.id,builderDigest:builder.implementationDigest,capabilityKind:builder.capabilityKind,packetDigest:packet.packetDigest}:null,baseCatalogDigest:catalog&&catalog.catalogDigest||null,proposedRecipe:proposedRecipe,proposedCatalog:catalogProjection,proposedRegistry:registryProjection,checks:{foundryPacketVerified:foundryVerification&&foundryVerification.state==='PASS',trustedTestVerified:testVerified,sourceReviewVerified:reviewVerified,mikeDecisionVerified:decisionVerified},holds:technicalHolds,effects:{sourceFilesWritten:false,catalogWritten:false,registryWritten:false,recipeActivated:false,generatedCodeExecuted:false,installed:false,registered:false,staged:false,promoted:false,canon:false,foundationChanged:false},authority:clone(AUTHORITY)};
  return Object.assign({},stable,{planDigest:digest(stable)});
}
function verifyPlan(plan){
  const checks=[];function check(id,pass){checks.push({id:id,pass:pass===true});}
  try{
    check('schema',plan.schema===PLAN_SCHEMA&&plan.version===VERSION);
    check('digest',receiptDigestValid(plan,'planDigest'));
    check('state',['HELD','AWAITING_SOURCE_REVIEW','AWAITING_MIKE_DECISION','READY_FOR_REVIEWED_MERGE'].includes(plan.state));
    check('ready-action',plan.state!=='READY_FOR_REVIEWED_MERGE'||(plan.action==='MERGE_EXACT_REGISTRY_AND_CATALOG_DIFF'&&plan.checks.foundryPacketVerified&&plan.checks.trustedTestVerified&&plan.checks.sourceReviewVerified&&plan.checks.mikeDecisionVerified));
    check('no-effects',plan.effects&&Object.values(plan.effects).every(function(value){return value===false;})&&authorityClosed(plan.authority));
    check('admission-bound',plan.state==='HELD'||safeDigest(plan.admissionDigest));
  }catch(_){check('parseable',false);}
  const stable={schema:VERIFICATION_SCHEMA,planDigest:plan&&safeDigest(plan.planDigest)?plan.planDigest:null,state:checks.every(function(row){return row.pass;})?'PASS':'FAIL',checks:checks};
  return Object.assign({},stable,{verificationDigest:digest(stable)});
}

module.exports={VERSION:VERSION,TEST_RECEIPT_SCHEMA:TEST_RECEIPT_SCHEMA,REVIEW_RECEIPT_SCHEMA:REVIEW_RECEIPT_SCHEMA,DECISION_SCHEMA:DECISION_SCHEMA,PLAN_SCHEMA:PLAN_SCHEMA,VERIFICATION_SCHEMA:VERIFICATION_SCHEMA,TEST_CONFIRMATION:TEST_CONFIRMATION,REVIEW_CONFIRMATION:REVIEW_CONFIRMATION,DECISION_CONFIRMATION:DECISION_CONFIRMATION,REVIEW_CASES:REVIEW_CASES,AUTHORITY:AUTHORITY,buildTestReceipt:buildTestReceipt,verifyTestReceipt:verifyTestReceipt,buildReviewReceipt:buildReviewReceipt,verifyReviewReceipt:verifyReviewReceipt,buildDecision:buildDecision,verifyDecision:verifyDecision,buildPlan:buildPlan,verifyPlan:verifyPlan};
