'use strict';

const Fabric = require('../../shared/capability-fabric/index.js');
const BuilderRegistry = require('../../shared/capability-fabric/builder-registry.js');

const ACTIONS = ['catalog.list','request.validate','build.plan','build.run','package.verify','composition.validate','composition.plan','composition.build','composition.verify','hand-request.adapt','recipe-proposal.inspect'];
const FORBIDDEN = ['filesystem.write','generated-code.execute','composition.execute','composition.materialize','install','register','stage','promote','permission-grant','network','canon','foundation.mutate','recipe.activate'];
function response(fields){return Object.assign({schema:'axm.capability-machine-response/v1',generatedCodeExecuted:false,providerCalled:false,authority:Fabric.clone(Fabric.AUTHORITY)},fields);}
function refusal(code,reason){return response({ok:false,refused:true,code:code,reason:reason});}
async function run(request){
  request=request||{};const action=String(request.action||''),input=request.input||{},catalog=Fabric.loadCatalog();
  if(ACTIONS.indexOf(action)<0)return refusal(FORBIDDEN.indexOf(action)>=0?'FORBIDDEN_ACTION':'UNSUPPORTED_ACTION','The machine door exposes pure validation, planning, in-memory compilation, and inspection only.');
  if(action==='catalog.list')return response({ok:true,catalog:{schema:catalog.schema,status:catalog.status,activationPolicy:catalog.activationPolicy,catalogDigest:catalog.catalogDigest,builderRegistry:BuilderRegistry.inventory(),recipes:catalog.recipes.map(function(row){return {id:row.id,version:row.version,title:row.title,family:row.family,capabilityKind:row.capabilityKind,builderId:row.builderId,builderDigest:row.builderDigest,recipeDigest:row.recipeDigest,defaultCandidates:row.candidatePolicy.defaultCount,defaultVariantId:row.candidatePolicy.defaultVariantId};})}});
  if(action==='request.validate'){const result=Fabric.validateRequest(input.request);return response({ok:result.ok,validation:result});}
  if(action==='build.plan'){const plan=Fabric.planBuild(input.request,catalog);return response({ok:plan.status==='READY',plan:plan});}
  if(action==='build.run'){const result=Fabric.build(input.request,catalog);return response({ok:result.status==='COMPLETE',run:result});}
  if(action==='package.verify'){const result=Fabric.verifyCandidate(input.candidate);return response({ok:result.ok,verification:result});}
  if(action==='composition.validate'){const result=Fabric.validateCompositionRequest(input.request);return response({ok:result.ok,validation:result});}
  if(action==='composition.plan'){const result=Fabric.planComposition(input.request,catalog);return response({ok:result.status==='READY',plan:result});}
  if(action==='composition.build'){const result=Fabric.buildComposition(input.request,catalog);return response({ok:result.status==='COMPLETE',build:result});}
  if(action==='composition.verify'){const result=Fabric.verifyComposition(input.build,catalog);return response({ok:result.state==='PASS',verification:result});}
  if(action==='hand-request.adapt'){const result=Fabric.adaptHandRequest(input.handRequest,input.target);return response({ok:result.ok,adaptation:result});}
  if(action==='recipe-proposal.inspect'){const result=Fabric.importRecipeProposal(input.proposal);return response({ok:result.ok,inspection:result});}
  return refusal('UNREACHABLE','No action executed.');
}

module.exports={run:run,ACTIONS:ACTIONS,FORBIDDEN:FORBIDDEN,response:response};
