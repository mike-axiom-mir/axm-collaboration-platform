'use strict';

const Fabric = require('../../shared/deterministic-organ-fabric/index.js');

const ACTIONS = ['fields.list', 'intent.parse', 'intent.validate', 'candidates.generate', 'candidates.evaluate', 'candidates.compare', 'package.verify', 'archive.stash.project', 'archive.stash.envelope', 'archive.connection.plan'];
const FORBIDDEN = ['archive.write', 'archive.connect', 'install', 'execute-from-disk', 'register', 'stage', 'promote', 'permission-grant', 'network', 'canon', 'foundation.mutate'];

function refusal(code, reason) { return { schema:'axm.organ-machine-response/v1', ok:false, refused:true, code:code, reason:reason, installed:false, registered:false, staged:false, promoted:false, canonChanged:false }; }
function getPack(id) { return Fabric.findPack(id); }
async function run(request) {
  request=request||{};const action=String(request.action||''),input=request.input||{};
  if(ACTIONS.indexOf(action)<0)return refusal(FORBIDDEN.indexOf(action)>=0?'FORBIDDEN_ACTION':'UNSUPPORTED_ACTION','The machine adapter exposes pure inspection and compilation actions only. Archive writes and authority-changing actions require another explicit host-owned surface.');
  const packs=Fabric.loadPacks();
  if(action==='fields.list')return {schema:'axm.organ-machine-response/v1',ok:true,fields:packs.map(function(pack){return {id:pack.id,version:pack.version,digest:pack.packDigest,title:pack.title,capability:pack.capability,humanJudgments:pack.humanJudgments};})};
  if(action==='intent.parse')return {schema:'axm.organ-machine-response/v1',ok:true,preview:Fabric.parseSentence(input.sentence,packs,input.preferredPackId)};
  if(action==='intent.validate'){const pack=getPack(input.packId||(input.intent&&input.intent.fieldPackRef&&input.intent.fieldPackRef.id));if(!pack)return refusal('FIELD_PACK_UNKNOWN','Exact field pack is unavailable.');const result=Fabric.validateIntent(input.intent,pack);return {schema:'axm.organ-machine-response/v1',ok:result.ok,validation:result};}
  if(action==='candidates.generate'){const pack=getPack(input.packId||(input.intent&&input.intent.fieldPackRef&&input.intent.fieldPackRef.id));if(!pack)return refusal('FIELD_PACK_UNKNOWN','Exact field pack is unavailable.');const result=Fabric.generateCandidates(input.intent,pack);return {schema:'axm.organ-machine-response/v1',ok:result.status==='COMPLETE',run:result};}
  if(action==='candidates.evaluate'){const pack=getPack(input.packId);if(!pack)return refusal('FIELD_PACK_UNKNOWN','Exact field pack is unavailable.');return {schema:'axm.organ-machine-response/v1',ok:true,evaluation:Fabric.evaluateDefinition(input.definition,input.intent,pack)};}
  if(action==='candidates.compare')return {schema:'axm.organ-machine-response/v1',ok:true,comparison:Fabric.compareCandidates(input.run)};
  if(action==='package.verify')return {schema:'axm.organ-machine-response/v1',ok:true,verification:Fabric.verifyPackage(input.candidate)};
  if(action==='archive.stash.project'){try{return {schema:'axm.organ-machine-response/v1',ok:true,projection:Fabric.projectArchiveStash(input.candidate),archiveWritten:false};}catch(error){return refusal('DORMANT_STASH_REFUSED',String(error.message||error));}}
  if(action==='archive.stash.envelope'){try{return {schema:'axm.organ-machine-response/v1',ok:true,envelope:Fabric.buildArchiveStashEnvelope(input.candidate,input.projection),archiveWritten:false};}catch(error){return refusal('DORMANT_STASH_REFUSED',String(error.message||error));}}
  if(action==='archive.connection.plan'){try{return {schema:'axm.organ-machine-response/v1',ok:true,plan:Fabric.buildArchiveConnectionPlan(input.candidate,input.projection),archiveWritten:false,mirrorWritten:false,hostAuthorizationRequired:true};}catch(error){return refusal('ARCHIVE_CONNECTION_PLAN_REFUSED',String(error.message||error));}}
  return refusal('UNREACHABLE','No action executed.');
}

module.exports={run:run,ACTIONS:ACTIONS,FORBIDDEN:FORBIDDEN};
