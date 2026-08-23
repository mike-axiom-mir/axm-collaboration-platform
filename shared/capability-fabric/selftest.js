#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Fabric = require('./index.js');

let passed=0;
function check(condition,label){assert(condition,label);passed+=1;}

function main(){
  const catalog=Fabric.loadCatalog(),catalogCheck=Fabric.validateCatalog(catalog);
  check(catalogCheck.ok,'digest-bound recipe catalog validates');
  check(catalog.recipes.length===3,'initial catalog has code, creation, and adapter recipes');
  check(catalog.recipes.every(function(row){return row.candidatePolicy.defaultCount===1;}),'every initial recipe defaults to one candidate');
  check(catalog.activationPolicy==='SOURCE_REVIEW_AND_MIKE_MERGE','shared activation policy preserves Mike merge gate');

  const packages={};
  catalog.recipes.forEach(function(recipe){
    const request=Fabric.sealRequest(recipe.exampleRequest,true),requestCheck=Fabric.validateRequest(request),plan=Fabric.planBuild(request,catalog),one=Fabric.build(request,catalog),two=Fabric.build(request,catalog);
    check(requestCheck.ok,recipe.id+' example seals into a valid request');
    check(plan.status==='READY'&&plan.candidateCount===1,recipe.id+' exact recipe plans one candidate');
    check(one.status==='COMPLETE'&&one.candidates.length===1,recipe.id+' builds one detached candidate');
    check(one.generatedCodeExecuted===false,recipe.id+' build does not execute generated code');
    check(Fabric.canonicalJson(one)===Fabric.canonicalJson(two),recipe.id+' rebuild is byte-identical');
    check(Fabric.verifyCandidate(one.candidates[0]).ok,recipe.id+' package verifies');
    check(Object.values(one.candidates[0].package.authority).every(function(value){return value===false;}),recipe.id+' package carries no authority');
    check(one.candidates[0].files['selftest.js']&&one.candidates[0].files['module-bundle.json'],recipe.id+' emits external tests and exact bundle');
    packages[recipe.id]=one.candidates[0];
  });

  const recipe=catalog.recipes[0],base=Fabric.sealRequest(recipe.exampleRequest,true),changedDraft=Fabric.clone(recipe.exampleRequest);changedDraft.parameters.defaultValue='different';const changed=Fabric.sealRequest(changedDraft,true);
  check(base.requestDigest!==changed.requestDigest,'semantic request change alters request digest');
  check(Fabric.build(base,catalog).candidates[0].package.packageDigest!==Fabric.build(changed,catalog).candidates[0].package.packageDigest,'semantic request change alters package digest');

  const unreviewed=Fabric.sealRequest(recipe.exampleRequest,false),unreviewedPlan=Fabric.planBuild(unreviewed,catalog);
  check(unreviewedPlan.status==='HELD'&&unreviewedPlan.holds[0].code==='AUTHORITY_HOLD','unreviewed request is held');
  const missingDraft=Fabric.clone(recipe.exampleRequest);missingDraft.recipeId='missing-recipe';const missing=Fabric.planBuild(Fabric.sealRequest(missingDraft,true),catalog);
  check(missing.status==='HELD'&&missing.holds[0].code==='MISSING_RECIPE','missing exact recipe returns typed hold');
  const implicitDraft=Fabric.clone(recipe.exampleRequest);implicitDraft.recipeId=null;const implicit=Fabric.planBuild(Fabric.sealRequest(implicitDraft,true),catalog);
  check(implicit.status==='READY'&&implicit.recipeRef.id===recipe.id,'single exact family match can be resolved without guessing');
  const ambiguousCatalog=Fabric.clone(catalog),copy=Fabric.clone(recipe);copy.id='pure-json-transform-alt';delete copy.recipeDigest;copy.recipeDigest=Fabric.digest(copy);ambiguousCatalog.recipes.push(copy);delete ambiguousCatalog.catalogDigest;ambiguousCatalog.catalogDigest=Fabric.digest(ambiguousCatalog);const ambiguous=Fabric.planBuild(Fabric.sealRequest(implicitDraft,true),ambiguousCatalog);
  check(ambiguous.status==='HELD'&&ambiguous.holds[0].code==='RECIPE_SELECTION_REQUIRED','ambiguous family returns selection hold');
  const invalid=Fabric.clone(base);invalid.parameters.extra=true;delete invalid.requestDigest;invalid.requestDigest=Fabric.digest(invalid);const invalidPlan=Fabric.planBuild(invalid,catalog);
  check(invalidPlan.status==='HELD'&&invalidPlan.holds[0].code==='CONTRACT_HOLD','unknown parameter is refused by closed recipe contract');

  const proposalRecipe=Fabric.clone(recipe);proposalRecipe.id='mirror-proposed-transform';const proposal={schema:Fabric.PROPOSAL_SCHEMA,sourceKind:'MIRROR',recipe:proposalRecipe,proposalDigest:Fabric.digest(proposalRecipe)},proposalResult=Fabric.importRecipeProposal(proposal);
  check(proposalResult.ok&&proposalResult.status==='INACTIVE_PROPOSAL'&&proposalResult.active===false,'Mirror recipe proposal remains inactive');
  check(proposalResult.providerCalled===false,'proposal inspection invokes no provider');

  const hand={schema:'axm.workshop-direction.hand-request/v1',handRequestId:'hand-proof',targetModuleId:'status-proof',title:'Build a status proof',reason:'No bounded callable hand exists.',desiredContract:'axm.direction-hand/status-proof/v1'},target={recipeId:'pure-json-transform',family:'code-module',parameters:Fabric.clone(recipe.exampleRequest.parameters),idSuffix:'capability'},adapted=Fabric.adaptHandRequest(hand,target);
  check(adapted.ok&&adapted.request.schema===Fabric.REQUEST_SCHEMA,'Workshop Direction hand request adapts to exact build request contract');
  check(adapted.request.humanReviewed===false&&adapted.status==='HUMAN_REVIEW_REQUIRED','adapted build request cannot self-approve');
  check(Fabric.validateRequest(adapted.request).ok,'adapted request carries a valid deterministic digest');
  check(Fabric.planBuild(adapted.request,catalog).status==='HELD','adapted request cannot build before human review');

  const tampered=Fabric.clone(packages['pure-json-transform']);tampered.files['capability.js']+='// drift\n';
  check(!Fabric.verifyCandidate(tampered).ok,'package byte tampering is detected');
  process.stdout.write('Capability Fabric shared selftest PASS · '+passed+' checks\n');
}

main();
