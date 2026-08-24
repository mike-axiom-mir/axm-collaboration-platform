'use strict';
const fabric=require('./machine-template-fabric.js');
const miner=require('./template-pattern-miner.js');
let INDEX=null;
function norm(v){return String(v||'').trim().toLowerCase()}
function buildIndex(){
  const byLanguage=new Map(),byIntent=new Map(),byBinding=new Map();
  for(const bank of fabric.all()){
    byLanguage.set(bank.languageId,bank);
    for(const t of bank.lanes.verifiedVault.templates){
      const ik=`${bank.languageId}|${norm(t.intent)}`;if(!byIntent.has(ik))byIntent.set(ik,[]);byIntent.get(ik).push(t);
      for(const b of t.nativeBindings){const bk=`${bank.languageId}|${norm(b)}`;if(!byBinding.has(bk))byBinding.set(bk,[]);byBinding.get(bk).push(t)}
    }
  }
  return Object.freeze({byLanguage,byIntent,byBinding});
}
function idx(){if(!INDEX)INDEX=buildIndex();return INDEX}
function score(t,qSignals,intent){let s=100;if(norm(t.intent)===intent)s+=50;for(const b of t.nativeBindings)if(qSignals.has(norm(b)))s+=7;return s}
function candidateScore(c,qSignals,intent){let s=40;if(norm(c.intent)===intent)s+=20;for(const x of c.contextTags||[])if(qSignals.has(norm(x)))s+=4;s+=Math.min(20,c.support||0)+Math.min(10,c.projectDiversity||0);return s}
function select({languageId,intent='reuse',signals=[],mode='MACHINE',topN=5,minedCandidates=[],allowCrossLanguage=false}={}){
  const I=idx();const bank=I.byLanguage.get(languageId);if(!bank)return{schema:'axm.code.template-selection.v1',result:'UNKNOWN_LANGUAGE',languageId:languageId||null,selected:[],authority:'NONE'};
  const qSignals=new Set((signals||[]).map(norm).filter(Boolean));const it=norm(intent);const pool=[...(I.byIntent.get(`${languageId}|${it}`)||[]),...bank.lanes.verifiedVault.templates.filter(t=>norm(t.intent)!==it)];
  const seen=new Set();const ranked=[];
  for(const t of pool){if(seen.has(t.id))continue;seen.add(t.id);ranked.push({lane:'VERIFIED_VAULT',score:score(t,qSignals,it),template:t})}
  for(const c of minedCandidates||[]){if(c.languageId!==languageId&&!allowCrossLanguage)continue;ranked.push({lane:'PATTERN_NURSERY',score:candidateScore(c,qSignals,it),candidate:c})}
  ranked.sort((a,b)=>b.score-a.score||String(a.template?.id||a.candidate?.candidateSha256).localeCompare(String(b.template?.id||b.candidate?.candidateSha256)));
  const limit=Math.max(1,Math.min(12,topN));let chosen=ranked.slice(0,limit);let nurseryDiscoverySlotUsed=false;
  const nurseryBest=ranked.find(x=>x.lane==='PATTERN_NURSERY'&&x.candidate?.languageId===languageId&&norm(x.candidate?.intent)===it);
  if(nurseryBest&&!chosen.some(x=>x.lane==='PATTERN_NURSERY')&&limit>1){chosen=[...chosen.slice(0,limit-1),nurseryBest];nurseryDiscoverySlotUsed=true;}
  const selected=chosen.map(x=>x.lane==='VERIFIED_VAULT'?capsule(x.template,mode,x.score):candidateCapsule(x.candidate,mode,x.score));
  return {schema:'axm.code.template-selection.v1',result:selected.length?'TEMPLATES_SELECTED':'NO_TEMPLATE_MATCH',languageId,intent,mode,selected,nurseryDiscoverySlotUsed,normalMachineFastPath:true,aiAndMachineShareTemplateIdentity:true,nurseryCandidateRemainsUnverified:true,authority:'NONE'};
}
function capsule(t,mode,score){
  const base={lane:'VERIFIED_VAULT',templateId:t.id,templateSha256:t.templateSha256,score,intent:t.intent,holeSchema:t.holes,verification:t.verifierCandidates,authority:'NONE'};
  if(mode==='AI')return{...base,capsuleClass:'COMPACT_AI_TEMPLATE_CAPSULE',nativeBindings:t.nativeBindings,steps:t.steps.map(s=>({phase:s.phase,opcode:s.opcode,emits:s.emits})),hardConstraints:['do not treat template as correctness proof','return source proposal to native verification','do not mutate without separate authority']};
  return{...base,capsuleClass:'DETERMINISTIC_MACHINE_TEMPLATE_CAPSULE',steps:t.steps,preconditions:t.preconditions,sourceRendering:t.use.sourceRenderingWithoutAdapter};
}
function candidateCapsule(c,mode,score){return{lane:'PATTERN_NURSERY',candidateSha256:c.candidateSha256,score,intent:c.intent,generalizedShape:c.generalizedShape,holes:c.holes,support:c.support,projectDiversity:c.projectDiversity,capsuleClass:mode==='AI'?'COMPACT_AI_MINED_CANDIDATE':'DETERMINISTIC_MACHINE_MINED_CANDIDATE',verified:false,automaticPromotion:false,authority:'NONE'}}
function instantiate({languageId,templateId,bindings={},renderAdapter=null}={}){
  const bank=idx().byLanguage.get(languageId);if(!bank)return{result:'UNKNOWN_LANGUAGE',authority:'NONE'};
  const t=bank.lanes.verifiedVault.templates.find(x=>x.id===templateId);if(!t)return{result:'UNKNOWN_TEMPLATE',languageId,templateId,authority:'NONE'};
  const missing=t.holes.filter(h=>h.required&&!(h.id in bindings)).map(h=>h.id);if(missing.length)return{schema:'axm.code.template-instance.v1',result:'TEMPLATE_BINDINGS_INCOMPLETE',languageId,templateId,missing,authority:'NONE'};
  const instanceBindings={};for(const h of t.holes)if(h.id in bindings)instanceBindings[h.id]={type:h.type,value:String(bindings[h.id])};
  return{schema:'axm.code.template-instance.v1',result:renderAdapter?'TEMPLATE_INSTANCE_READY_RENDERER_BOUND_EXECUTION_HELD':'TEMPLATE_INSTANCE_READY_RENDER_HELD',languageId,templateId,templateSha256:t.templateSha256,bindings:instanceBindings,steps:t.steps,renderAdapter:renderAdapter?{id:String(renderAdapter.id||''),digest:String(renderAdapter.digest||'')}:null,verificationRequired:t.verifierCandidates,sourceCode:null,toolExecution:false,workspaceMutation:false,authority:'NONE'};
}
function mineAndSelect({samples=[],query={}}={}){const mining=miner.mine(samples);return{schema:'axm.code.template-mine-and-select.v1',mining,selection:select({...query,minedCandidates:mining.candidates}),authority:'NONE'}}
module.exports={select,instantiate,mineAndSelect,buildIndex};
