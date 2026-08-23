#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Machine = require('./machine.js');
const Fabric = require('../../shared/capability-fabric/index.js');
const AdmissionSelftest = require('../capability-recipe-admission-gate/selftest.js');

(async function(){
  const catalog=Fabric.loadCatalog(),request=Fabric.sealRequest(catalog.recipes[0].exampleRequest,true);
  const list=await Machine.run({action:'catalog.list'});assert(list.ok&&list.catalog.recipes.length===5&&list.catalog.builderRegistry.entries.filter(function(row){return row.status==='REVIEW_CANDIDATE';}).length===0&&list.generatedCodeExecuted===false&&list.providerCalled===false&&Object.values(list.authority).every(function(value){return value===false;}));
  const valid=await Machine.run({action:'request.validate',input:{request:request}});assert(valid.ok);
  const plan=await Machine.run({action:'build.plan',input:{request:request}});assert(plan.ok&&plan.plan.status==='READY');
  const built=await Machine.run({action:'build.run',input:{request:request}});assert(built.ok&&built.run.generatedCodeExecuted===false);
  const verified=await Machine.run({action:'package.verify',input:{candidate:built.run.candidates[0]}});assert(verified.ok);
  const draft=Fabric.clone(catalog.recipes[0]);delete draft.recipeDigest;delete draft.builderDigest;draft.schema=Fabric.PROPOSAL_RECIPE_SCHEMA;draft.id='machine-proposed-transform';draft.activation='INACTIVE_PROPOSAL';draft.exampleRequest.id='machine-proposed-transform-example';draft.exampleRequest.recipeId=draft.id;const proposal={schema:Fabric.PROPOSAL_SCHEMA,sourceKind:'CODE_FABRIC',recipe:draft,proposalDigest:Fabric.digest(draft)};
  const inspected=await Machine.run({action:'recipe-proposal.inspect',input:{proposal:proposal}});assert(inspected.ok&&inspected.inspection.active===false&&inspected.inspection.requiresMikeMerge===true);
  const activeClaim=Fabric.clone(proposal);activeClaim.recipe.activation=Fabric.ACTIVE_RECIPE;activeClaim.proposalDigest=Fabric.digest(activeClaim.recipe);const refusedProposal=await Machine.run({action:'recipe-proposal.inspect',input:{proposal:activeClaim}});assert(!refusedProposal.ok);
  const forbidden=await Machine.run({action:'filesystem.write'});assert(!forbidden.ok&&forbidden.refused&&forbidden.code==='FORBIDDEN_ACTION');
  const activate=await Machine.run({action:'recipe.activate'});assert(!activate.ok&&activate.code==='FORBIDDEN_ACTION');
  const unsupported=await Machine.run({action:'surprise'});assert(!unsupported.ok&&unsupported.code==='UNSUPPORTED_ACTION');
  AdmissionSelftest.main();
  process.stdout.write('Capability Fabric tool selftest PASS · 10 checks\n');
})().catch(function(error){console.error(error.stack||error);process.exitCode=1;});
