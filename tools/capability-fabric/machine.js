'use strict';

const Fabric = require('../../shared/capability-fabric/index.js');

const ACTIONS = ['catalog.list','request.validate','build.plan','build.run','package.verify','hand-request.adapt','recipe-proposal.inspect'];
const FORBIDDEN = ['filesystem.write','generated-code.execute','install','register','stage','promote','permission-grant','network','canon','foundation.mutate','recipe.activate'];
function refusal(code,reason){return {schema:'axm.capability-machine-response/v1',ok:false,refused:true,code:code,reason:reason,authority:Fabric.clone(Fabric.AUTHORITY)};}
async function run(request){
  request=request||{};const action=String(request.action||''),input=request.input||{},catalog=Fabric.loadCatalog();
  if(ACTIONS.indexOf(action)<0)return refusal(FORBIDDEN.indexOf(action)>=0?'FORBIDDEN_ACTION':'UNSUPPORTED_ACTION','The machine door exposes pure validation, planning, in-memory compilation, and inspection only.');
  if(action==='catalog.list')return {schema:'axm.capability-machine-response/v1',ok:true,catalog:{schema:catalog.schema,status:catalog.status,activationPolicy:catalog.activationPolicy,catalogDigest:catalog.catalogDigest,recipes:catalog.recipes.map(function(row){return {id:row.id,version:row.version,title:row.title,family:row.family,builderId:row.builderId,recipeDigest:row.recipeDigest,defaultCandidates:row.candidatePolicy.defaultCount};})}};
  if(action==='request.validate'){const result=Fabric.validateRequest(input.request);return {schema:'axm.capability-machine-response/v1',ok:result.ok,validation:result};}
  if(action==='build.plan'){const plan=Fabric.planBuild(input.request,catalog);return {schema:'axm.capability-machine-response/v1',ok:plan.status==='READY',plan:plan};}
  if(action==='build.run'){const result=Fabric.build(input.request,catalog);return {schema:'axm.capability-machine-response/v1',ok:result.status==='COMPLETE',run:result};}
  if(action==='package.verify'){const result=Fabric.verifyCandidate(input.candidate);return {schema:'axm.capability-machine-response/v1',ok:result.ok,verification:result};}
  if(action==='hand-request.adapt'){const result=Fabric.adaptHandRequest(input.handRequest,input.target);return {schema:'axm.capability-machine-response/v1',ok:result.ok,adaptation:result};}
  if(action==='recipe-proposal.inspect'){const result=Fabric.importRecipeProposal(input.proposal);return {schema:'axm.capability-machine-response/v1',ok:result.ok,inspection:result};}
  return refusal('UNREACHABLE','No action executed.');
}

module.exports={run:run,ACTIONS:ACTIONS,FORBIDDEN:FORBIDDEN};
