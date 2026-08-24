#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Fabric = require('./index.js');
const BuilderRegistry = require('./builder-registry.js');

let passed=0;
function check(condition,label){assert(condition,label);passed+=1;}
function resealPlan(plan){const copy=Fabric.clone(plan);delete copy.planDigest;plan.planDigest=Fabric.digest(copy);return plan;}
function resealCandidate(candidate){
  const bundle={schema:'axm.module-bundle/v1',id:candidate.package.id,version:candidate.package.version,requiredSeats:1,files:Object.keys(candidate.files).filter(function(path){return path!=='module-bundle.json';}).sort().map(function(path){return {path:path,encoding:'utf8',sha256:Fabric.digest(candidate.files[path]).slice(7),content:candidate.files[path]};})};
  candidate.files['module-bundle.json']=JSON.stringify(bundle,null,2)+'\n';
  candidate.package.files=Object.keys(candidate.files).sort().map(function(path){return {path:path,bytes:Buffer.byteLength(candidate.files[path],'utf8'),digest:Fabric.digest(candidate.files[path])};});
  candidate.package.totalBytes=candidate.package.files.reduce(function(sum,row){return sum+row.bytes;},0);
  const descriptor=Fabric.clone(candidate.package);delete descriptor.packageDigest;candidate.package.packageDigest=Fabric.digest(descriptor);return candidate;
}

function main(){
  const catalog=Fabric.loadCatalog(),catalogCheck=Fabric.validateCatalog(catalog);
  check(catalogCheck.ok,'digest-bound recipe catalog validates');
  check(catalog.recipes.length===6,'reviewed catalog has one portable SKILL plus validator, code, markup, creation, and adapter HAND recipes');
  check(catalog.recipes.filter(function(row){return row.capabilityKind==='HAND'&&row.capabilityContract.runtimeMode==='EXECUTABLE';}).length===5&&catalog.recipes.filter(function(row){return row.capabilityKind==='SKILL'&&row.capabilityContract.runtimeMode==='HOST_MEDIATED';}).length===1,'reviewed active recipes preserve their exact modular kind and runtime boundary');
  check(catalog.recipes.every(function(row){return row.candidatePolicy.defaultCount===1&&row.candidatePolicy.variants.some(function(variant){return variant.id===row.candidatePolicy.defaultVariantId;});}),'every reviewed recipe explicitly defaults to one named candidate variant');
  check(catalog.activationPolicy==='SOURCE_REVIEW_AND_MIKE_MERGE','shared activation policy preserves Mike merge gate');
  check(BuilderRegistry.activeIds().length===6&&BuilderRegistry.reviewCandidateIds().join(',')==='closed-object-contract-adapter-v1','modular builder registry keeps six reviewed builders active and one exact adapter review candidate inactive');
  check(catalog.recipes.every(function(row){const builder=BuilderRegistry.describe(row.builderId);return builder&&row.builderDigest===builder.implementationDigest;}),'every active recipe binds the exact modular builder digest');

  const packages={};
  catalog.recipes.forEach(function(recipe){
    const request=Fabric.sealRequest(recipe.exampleRequest,true),requestCheck=Fabric.validateRequest(request),plan=Fabric.planBuild(request,catalog),one=Fabric.build(request,catalog),two=Fabric.build(request,catalog);
    check(requestCheck.ok,recipe.id+' example seals into a valid request');
    check(plan.status==='READY'&&plan.candidateCount===1&&plan.recipeRef.capabilityKind===recipe.capabilityKind&&plan.recipeRef.builderDigest===recipe.builderDigest,recipe.id+' exact recipe plans one kind-and-builder-bound candidate');
    check(one.status==='COMPLETE'&&one.candidates.length===1,recipe.id+' builds one detached candidate');
    check(one.generatedCodeExecuted===false,recipe.id+' build does not execute generated code');
    check(Fabric.canonicalJson(one)===Fabric.canonicalJson(two),recipe.id+' rebuild is byte-identical');
    check(Fabric.verifyCandidate(one.candidates[0]).ok,recipe.id+' package verifies');
    check(Object.values(one.candidates[0].package.authority).every(function(value){return value===false;}),recipe.id+' package carries no authority');
    const selftestPath=recipe.capabilityKind==='HAND'?'selftest.js':'skill.selftest.js';
    check(one.candidates[0].files[selftestPath]&&one.candidates[0].files['module-bundle.json'],recipe.id+' emits its kind-specific external test and exact bundle');
    const modular=JSON.parse(one.candidates[0].files['modular-capability.contract.json']);
    const modularBody=Fabric.clone(modular);delete modularBody.contractDigest;check(modular.kind===recipe.capabilityKind&&modular.contractDigest===Fabric.digest(modularBody),recipe.id+' emits a digest-bound modular capability contract');
    packages[recipe.id]=one.candidates[0];
  });

  const recipe=catalog.recipes.find(function(row){return row.id==='pure-json-transform';}),base=Fabric.sealRequest(recipe.exampleRequest,true),changedDraft=Fabric.clone(recipe.exampleRequest);changedDraft.parameters.defaultValue='different';const changed=Fabric.sealRequest(changedDraft,true);
  check(base.requestDigest!==changed.requestDigest,'semantic request change alters request digest');
  check(Fabric.build(base,catalog).candidates[0].package.packageDigest!==Fabric.build(changed,catalog).candidates[0].package.packageDigest,'semantic request change alters package digest');
  const builderDriftCatalog=Fabric.clone(catalog),builderDriftRecipe=builderDriftCatalog.recipes.find(function(row){return row.id===recipe.id;});builderDriftRecipe.builderDigest=Fabric.digest('wrong builder');delete builderDriftRecipe.recipeDigest;builderDriftRecipe.recipeDigest=Fabric.digest(builderDriftRecipe);delete builderDriftCatalog.catalogDigest;builderDriftCatalog.catalogDigest=Fabric.digest(builderDriftCatalog);
  check(Fabric.planBuild(base,builderDriftCatalog).status==='HELD','builder implementation digest drift becomes a catalog hold');

  const unreviewed=Fabric.sealRequest(recipe.exampleRequest,false),unreviewedPlan=Fabric.planBuild(unreviewed,catalog);
  check(unreviewedPlan.status==='HELD'&&unreviewedPlan.holds[0].code==='AUTHORITY_HOLD','unreviewed request is held');
  const missingDraft=Fabric.clone(recipe.exampleRequest);missingDraft.recipeId='missing-recipe';const missing=Fabric.planBuild(Fabric.sealRequest(missingDraft,true),catalog);
  check(missing.status==='HELD'&&missing.holds[0].code==='MISSING_RECIPE','missing exact recipe returns typed hold');
  const implicitDraft=Fabric.clone(recipe.exampleRequest);implicitDraft.recipeId=null;const implicit=Fabric.planBuild(Fabric.sealRequest(implicitDraft,true),catalog);
  check(implicit.status==='READY'&&implicit.recipeRef.id===recipe.id,'single exact family match can be resolved without guessing');
  const ambiguousCatalog=Fabric.clone(catalog),copy=Fabric.clone(recipe);copy.id='pure-json-transform-alt';copy.exampleRequest.recipeId=copy.id;delete copy.recipeDigest;copy.recipeDigest=Fabric.digest(copy);ambiguousCatalog.recipes.push(copy);delete ambiguousCatalog.catalogDigest;ambiguousCatalog.catalogDigest=Fabric.digest(ambiguousCatalog);const ambiguous=Fabric.planBuild(Fabric.sealRequest(implicitDraft,true),ambiguousCatalog);
  check(ambiguous.status==='HELD'&&ambiguous.holds[0].code==='RECIPE_SELECTION_REQUIRED','ambiguous family returns selection hold');
  const invalid=Fabric.clone(base);invalid.parameters.extra=true;delete invalid.requestDigest;invalid.requestDigest=Fabric.digest(invalid);const invalidPlan=Fabric.planBuild(invalid,catalog);
  check(invalidPlan.status==='HELD'&&invalidPlan.holds[0].code==='CONTRACT_HOLD','unknown parameter is refused by closed recipe contract');
  const defaultedCatalog=Fabric.clone(catalog),defaultedRecipe=defaultedCatalog.recipes.find(function(row){return row.id===recipe.id;});defaultedRecipe.candidatePolicy.variants[0].parameterOverrides={defaultValue:'from-variant'};delete defaultedRecipe.recipeDigest;defaultedRecipe.recipeDigest=Fabric.digest(defaultedRecipe);delete defaultedCatalog.catalogDigest;defaultedCatalog.catalogDigest=Fabric.digest(defaultedCatalog);const defaultedDraft=Fabric.clone(recipe.exampleRequest);delete defaultedDraft.parameters.defaultValue;const defaultedRequest=Fabric.sealRequest(defaultedDraft,true),defaultedPlan=Fabric.planBuild(defaultedRequest,defaultedCatalog);
  check(defaultedPlan.status==='READY'&&Fabric.build(defaultedRequest,defaultedCatalog).status==='COMPLETE','default variant overrides are resolved before required-parameter validation');
  const invalidVariantCatalog=Fabric.clone(catalog),invalidVariantRecipe=invalidVariantCatalog.recipes.find(function(row){return row.id===recipe.id;});invalidVariantRecipe.candidatePolicy.variants[0].parameterOverrides={undeclared:true};delete invalidVariantRecipe.recipeDigest;invalidVariantRecipe.recipeDigest=Fabric.digest(invalidVariantRecipe);delete invalidVariantCatalog.catalogDigest;invalidVariantCatalog.catalogDigest=Fabric.digest(invalidVariantCatalog);const invalidVariantPlan=Fabric.planBuild(base,invalidVariantCatalog);
  check(invalidVariantPlan.status==='HELD'&&invalidVariantPlan.holds[0].code==='CATALOG_HOLD','invalid variant override becomes a typed catalog hold before compilation');
  const forgedPlan=Fabric.clone(Fabric.planBuild(base,catalog));forgedPlan.requestDigest=unreviewed.requestDigest;resealPlan(forgedPlan);assert.throws(function(){Fabric.buildCandidate(unreviewed,catalog,forgedPlan);});passed+=1;
  const weakenedPlan=Fabric.clone(Fabric.planBuild(base,catalog));weakenedPlan.candidateCount=0;resealPlan(weakenedPlan);assert.throws(function(){Fabric.buildCandidate(base,catalog,weakenedPlan);});passed+=1;
  check(true,'exported candidate builder refuses forged or weakened READY plans');

  const proposalRecipe=Fabric.clone(recipe);delete proposalRecipe.recipeDigest;delete proposalRecipe.builderDigest;proposalRecipe.schema=Fabric.PROPOSAL_RECIPE_SCHEMA;proposalRecipe.id='mirror-proposed-transform';proposalRecipe.activation='INACTIVE_PROPOSAL';proposalRecipe.exampleRequest.id='mirror-proposed-transform-example';proposalRecipe.exampleRequest.recipeId=proposalRecipe.id;const proposal={schema:Fabric.PROPOSAL_SCHEMA,sourceKind:'MIRROR',recipe:proposalRecipe,proposalDigest:Fabric.digest(proposalRecipe)},proposalResult=Fabric.importRecipeProposal(proposal);
  check(proposalResult.ok&&proposalResult.status==='INACTIVE_PROPOSAL'&&proposalResult.active===false,'Mirror recipe proposal remains inactive');
  check(proposalResult.providerCalled===false,'proposal inspection invokes no provider');
  const humanProposal=Fabric.clone(proposal);humanProposal.sourceKind='HUMAN';const codexProposal=Fabric.clone(proposal);codexProposal.sourceKind='CODEX';
  check(Fabric.importRecipeProposal(humanProposal).ok&&Fabric.importRecipeProposal(codexProposal).ok,'human and Codex authors retain truthful inactive proposal provenance');
  const skillProposal=Fabric.clone(proposal);skillProposal.recipe.id='portable-review-skill';skillProposal.recipe.family='capability-review';skillProposal.recipe.capabilityKind='SKILL';skillProposal.recipe.capabilityContract={runtimeMode:'HOST_MEDIATED',entry:null,operation:'followProcedure',portableForm:'SKILL_MD',portablePath:'SKILL.md',resultContractPolicy:'BUILDER_PROVIDES_EXACT',requiredHostCapabilities:['human-or-agent-procedure-runner/v1']};skillProposal.recipe.exampleRequest.id='portable-review-skill-example';skillProposal.recipe.exampleRequest.family=skillProposal.recipe.family;skillProposal.recipe.exampleRequest.recipeId=skillProposal.recipe.id;skillProposal.proposalDigest=Fabric.digest(skillProposal.recipe);
  check(Fabric.importRecipeProposal(skillProposal).ok&&Fabric.importRecipeProposal(skillProposal).active===false,'first-class SKILL proposal is accepted only as inactive review material');
  const invalidSkill=Fabric.clone(skillProposal);invalidSkill.recipe.capabilityContract.portablePath=null;invalidSkill.proposalDigest=Fabric.digest(invalidSkill.recipe);
  check(!Fabric.importRecipeProposal(invalidSkill).ok,'SKILL proposal without portable SKILL.md binding is refused');
  const activeClaim=Fabric.clone(proposal);activeClaim.recipe.activation=Fabric.ACTIVE_RECIPE;activeClaim.proposalDigest=Fabric.digest(activeClaim.recipe);const activeClaimResult=Fabric.importRecipeProposal(activeClaim);
  check(!activeClaimResult.ok&&activeClaimResult.errors.some(function(row){return row.code==='PROPOSAL_ACTIVATION_REFUSED';}),'proposal inspection refuses an active-recipe claim');
  const malformedProposal={schema:Fabric.PROPOSAL_SCHEMA,sourceKind:'AI',recipe:{},proposalDigest:Fabric.digest({})};
  check(!Fabric.importRecipeProposal(malformedProposal).ok,'under-specified recipe proposal is refused without provider execution');

  const hand={schema:'axm.workshop-direction.hand-request/v1',handRequestId:'hand-proof',targetModuleId:'status-proof',title:'Build a status proof',reason:'No bounded callable hand exists.',desiredContract:'axm.direction-hand/status-proof/v1'},target={recipeId:'pure-json-transform',family:'code-module',parameters:Fabric.clone(recipe.exampleRequest.parameters),idSuffix:'capability'},adapted=Fabric.adaptHandRequest(hand,target);
  check(adapted.ok&&adapted.request.schema===Fabric.REQUEST_SCHEMA,'Workshop Direction hand request adapts to exact build request contract');
  check(adapted.request.humanReviewed===false&&adapted.status==='HUMAN_REVIEW_REQUIRED','adapted build request cannot self-approve');
  check(Fabric.validateRequest(adapted.request).ok,'adapted request carries a valid deterministic digest');
  check(Fabric.planBuild(adapted.request,catalog).status==='HELD','adapted request cannot build before human review');

  const tampered=Fabric.clone(packages['pure-json-transform']);tampered.files['capability.js']+='// drift\n';
  check(!Fabric.verifyCandidate(tampered).ok,'package byte tampering is detected');
  const installedManifest=Fabric.clone(packages['pure-json-transform']),manifest=JSON.parse(installedManifest.files['manifest.json']);manifest.installed=true;installedManifest.files['manifest.json']=JSON.stringify(manifest,null,2)+'\n';resealCandidate(installedManifest);const manifestCheck=Fabric.verifyCandidate(installedManifest);
  check(!manifestCheck.ok&&manifestCheck.errors.some(function(row){return row.code==='MANIFEST_AUTHORITY_DRIFT';}),'rehashing cannot hide an installed manifest authority conflict');
  const writableContract=Fabric.clone(packages['pure-json-transform']),contract=JSON.parse(writableContract.files['module.contract.json']);contract.permissions=['filesystem'];writableContract.files['module.contract.json']=JSON.stringify(contract,null,2)+'\n';resealCandidate(writableContract);const contractCheck=Fabric.verifyCandidate(writableContract);
  check(!contractCheck.ok&&contractCheck.errors.some(function(row){return row.code==='CONTRACT_AUTHORITY_DRIFT';}),'rehashing cannot hide a permission-bearing contract');
  const weakenedEvidence=Fabric.clone(packages['pure-json-transform']),evidence=JSON.parse(weakenedEvidence.files['evidence-route.json']);evidence.notProven=[];weakenedEvidence.files['evidence-route.json']=JSON.stringify(evidence,null,2)+'\n';resealCandidate(weakenedEvidence);const evidenceCheck=Fabric.verifyCandidate(weakenedEvidence);
  check(!evidenceCheck.ok&&evidenceCheck.errors.some(function(row){return row.code==='EVIDENCE_BOUNDARY_DRIFT';}),'rehashing cannot erase required not-proven evidence boundaries');
  const promotedDescriptor=Fabric.clone(packages['pure-json-transform']);promotedDescriptor.package.authority.promoted=true;const promotedBody=Fabric.clone(promotedDescriptor.package);delete promotedBody.packageDigest;promotedDescriptor.package.packageDigest=Fabric.digest(promotedBody);const promotedCheck=Fabric.verifyCandidate(promotedDescriptor);
  check(!promotedCheck.ok&&promotedCheck.errors.some(function(row){return row.code==='DETACHED_AUTHORITY_CONFLICT';}),'rehashing cannot hide descriptor promotion authority');
  const byteLie=Fabric.clone(packages['pure-json-transform']);byteLie.package.files[0].bytes+=1;const byteLieBody=Fabric.clone(byteLie.package);delete byteLieBody.packageDigest;byteLie.package.packageDigest=Fabric.digest(byteLieBody);
  check(!Fabric.verifyCandidate(byteLie).ok,'rehashing cannot hide false file byte declarations');
  const kindDrift=Fabric.clone(packages['pure-json-transform']),modularDrift=JSON.parse(kindDrift.files['modular-capability.contract.json']);modularDrift.runtime.operation='promote';delete modularDrift.contractDigest;modularDrift.contractDigest=Fabric.digest(modularDrift);kindDrift.files['modular-capability.contract.json']=JSON.stringify(modularDrift,null,2)+'\n';resealCandidate(kindDrift);
  check(!Fabric.verifyCandidate(kindDrift).ok&&Fabric.verifyCandidate(kindDrift).errors.some(function(row){return row.code==='MODULAR_CONTRACT_DRIFT';}),'rehashing cannot drift modular HAND runtime semantics');
  process.stdout.write('Capability Fabric shared selftest PASS · '+passed+' checks\n');
}

main();
