'use strict';
const Broker=require('./artifact-handoff-broker');
const CRITICAL=[
  {source:'studio',artifact:'image/png',destination:'film-motion-studio'},
  {source:'audio-studio',artifact:'audio/*',destination:'film-motion-studio'},
  {source:'knowledge-canvas',artifact:'axm.knowledge-project-handoff/v1',destination:'project-room'},
  {source:'film-motion-studio',artifact:'image/png',destination:'studio'}
];
function audit(tools,guidance){const all=Broker.catalog(tools),errors=[],warnings=[],ids={};all.forEach(x=>{if(ids[x.id])errors.push('duplicate tool '+x.id);ids[x.id]=true;if(!x.accepts.length)errors.push(x.id+' has no accepted artifact');if(!x.produces.length)errors.push(x.id+' has no produced artifact');});const serviceGuide=guidance&&guidance.services||{};all.forEach(x=>(x.readiness||[]).forEach(id=>{if(!serviceGuide[id])errors.push(x.id+' readiness '+id+' has no guidance');}));const criticalRoutes=CRITICAL.map(canary=>{let matches=[];try{matches=Broker.compatible(all,canary.source,canary.artifact);}catch(e){errors.push(canary.source+' canary error: '+e.message);}const pass=matches.some(x=>x.destinationId===canary.destination);if(!pass)errors.push(canary.source+' '+canary.artifact+' cannot reach '+canary.destination);return Object.assign({},canary,{pass});});const sourceCount=Broker.sources(all).length,routeCount=all.reduce((n,x)=>n+(x.integratedInto?0:Broker.compatible(all,x.id).length),0);if(!routeCount)errors.push('no declared cross-workspace routes');return{schema:'axm.artifact-envelope-audit/v1',ok:errors.length===0,errors,warnings,total:all.length,sourceCount,routeCount,criticalRoutes,truth:{declaredCompatibilityOnly:true,implementationEvidenceComplete:false,automaticConversion:false}};}
module.exports={CRITICAL,audit};
