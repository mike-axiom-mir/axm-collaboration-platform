'use strict';
const crypto=require('crypto');
const routes=require('./code-route-knowledge.js');
const registry=require('./registry.js');
const disciplines=require('./human-discipline-perspective-fabric.js');
const TOPOLOGY_SOURCE=require('./prebuild-preview-topologies.json');
const AUTHORITY=Object.freeze({workspaceRead:false,workspaceMutation:false,toolExecution:false,network:false,install:false,promotion:false,canon:false});
function canon(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return`[${v.map(canon).join(',')}]`;return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`}
function hash(v){return crypto.createHash('sha256').update(canon(v)).digest('hex')}
function norm(v){return String(v||'').trim().toLowerCase()}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))}
function topology(recipeId){return TOPOLOGY_SOURCE.topologies.find(x=>x.recipeId===recipeId)||null}
function validBinding(role,binding){const organ=registry.getByLanguageId(binding);if(!organ)return{ok:false,reason:'UNKNOWN_LANGUAGE'};if(!role.families.includes(organ.family))return{ok:false,reason:'LANGUAGE_FAMILY_NOT_ALLOWED',family:organ.family};return{ok:true,organ}}
function perspectiveFor(languageId,observation){try{return disciplines.compose({languageId,observation,intent:'review',topDisciplines:4,templateTopN:3})}catch(error){return{schema:'axm.code.discipline-grammar-intersection.v1',result:'PERSPECTIVE_COMPOSE_FAILED',languageId,error:String(error.message||error),authority:'NONE'}}}
function buildPlan({goal,activeLanguageIds=[],preferredLanguageIds=[],roleBindings={},observation={},topRecipes=1}={}){
 const routePlan=routes.planGoal({goal,activeLanguageIds,preferredLanguageIds,topRecipes});
 if(routePlan.result!=='ROUTE_RECIPES_FOUND')return{schema:'axm.code.prebuild-plan.v1',result:'NO_PREBUILD_PLAN',goal:goal||null,routePlan,authority:'NONE'};
 const recipe=routePlan.recipes[0],topo=topology(recipe.id);
 if(!topo)return{schema:'axm.code.prebuild-plan.v1',result:'PREVIEW_TOPOLOGY_MISSING',goal,recipeId:recipe.id,authority:'NONE'};
 const bindingErrors=[];
 const nodes=recipe.roles.map((role,index)=>{
   const requested=roleBindings&&roleBindings[role.role]!=null?norm(roleBindings[role.role]):null;
   let bound=null,boundOrgan=null;
   if(requested){const v=validBinding(role,requested);if(!v.ok)bindingErrors.push({role:role.role,languageId:requested,reason:v.reason,family:v.family||null});else{bound=requested;boundOrgan=v.organ}}
   const active=role.candidates.filter(c=>c.active).map(c=>c.languageId);
   const candidates=role.candidates.slice(0,8).map(c=>({languageId:c.languageId,organId:c.organId,family:c.family,kind:c.kind,score:c.score,active:c.active,preferred:c.preferred}));
   const state=bound?'EXPLICITLY_BOUND':active.length?'ACTIVE_LANGUAGE_AVAILABLE_UNBOUND':'UNBOUND';
   return {id:`role:${role.role}`,index,role:role.role,optional:!!role.optional,families:[...role.families],state,boundLanguageId:bound,bindingSource:bound?'CALLER_EXPLICIT':null,activeLanguageIds:active,candidates,artifactState:'PLANNED_NOT_GENERATED',organId:boundOrgan?boundOrgan.organId:null,authority:'NONE'};
 });
 const byRole=new Map(nodes.map(n=>[n.role,n]));
 const edges=topo.connections.map((c,index)=>{
   const from=byRole.get(c.from),to=byRole.get(c.to);
   if(!from||!to)return{id:`edge:${index}`,from:c.from,to:c.to,required:!!c.required,routeClassCandidates:[...c.routeClassCandidates],state:'TOPOLOGY_ENDPOINT_MISSING',matchedRoute:null,authority:'NONE'};
   let state='UNBOUND_ROUTE',matchedRoute=null,relation=null;
   if(from.boundLanguageId&&to.boundLanguageId){
     relation=routes.relate({languageA:from.boundLanguageId,languageB:to.boundLanguageId});
     matchedRoute=(relation.routes||[]).find(r=>c.routeClassCandidates.includes(r.class))||null;
     state=matchedRoute?'BOUND_ROUTE_SUPPORTED':'BOUND_ROUTE_UNKNOWN_OR_ADAPTER_REQUIRED';
   }
   return{id:`edge:${index}`,from:c.from,to:c.to,required:!!c.required,routeClassCandidates:[...c.routeClassCandidates],state,matchedRoute:matchedRoute?{id:matchedRoute.id,class:matchedRoute.class,knowledgeSource:matchedRoute.knowledgeSource||null,score:matchedRoute.score}:null,relationResult:relation?relation.result:null,authority:'NONE'};
 });
 const disciplineLayers=[];
 for(const n of nodes)if(n.boundLanguageId)disciplineLayers.push({role:n.role,languageId:n.boundLanguageId,intersection:perspectiveFor(n.boundLanguageId,{...observation,activeLanguages:[n.boundLanguageId]})});
 const requiredUnbound=nodes.filter(n=>!n.optional&&!n.boundLanguageId).map(n=>n.role);
 const requiredUnknownRoutes=edges.filter(e=>e.required&&e.state==='BOUND_ROUTE_UNKNOWN_OR_ADAPTER_REQUIRED').map(e=>`${e.from}->${e.to}`);
 const topologyErrors=edges.filter(e=>e.state==='TOPOLOGY_ENDPOINT_MISSING').map(e=>`${e.from}->${e.to}`);
 const holds=[];
 if(bindingErrors.length)holds.push('INVALID_ROLE_BINDINGS');
 if(requiredUnbound.length)holds.push('REQUIRED_ROLE_BINDINGS_MISSING');
 if(requiredUnknownRoutes.length)holds.push('REQUIRED_ROUTE_BINDING_UNKNOWN');
 if(topologyErrors.length)holds.push('PREVIEW_TOPOLOGY_INVALID');
 const simulation={schema:'axm.code.prebuild-structural-simulation.v1',structuralTwinReady:bindingErrors.length===0&&topologyErrors.length===0,sourceGenerationReady:holds.length===0,runtimeBehaviorSimulated:false,runtimeCorrectnessClaimed:false,requiredUnboundRoles:requiredUnbound,requiredUnknownRoutes,topologyErrors,bindingErrors,holds,state:holds.length?'SOURCE_GENERATION_HELD':'READY_FOR_SOURCE_PROPOSAL',note:'This simulates construction structure, boundaries and evidence state; arbitrary runtime behavior remains UNKNOWN until executable evidence exists.',authority:'NONE'};
 const core={schema:'axm.code.prebuild-plan.v1',version:'1.0.0',result:'PREBUILD_TWIN_READY',goal:norm(goal),routeRecipe:{id:recipe.id,score:recipe.score,why:recipe.why,routeClasses:[...recipe.routeClasses]},routeKnowledgeSnapshot:routes.snapshot().snapshotSha256,nodes,edges,disciplineLayers,simulation,truth:{planOnly:true,sourceGenerated:false,workspaceRead:false,workspaceWritten:false,toolchainExecuted:false,runtimeBehaviorSimulated:false,bestArchitectureClaimed:false,roleSelectionAuthority:'CALLER_OR_SEPARATE_GATE_ONLY'},authority:AUTHORITY};
 return {...core,planDigest:hash(core)};
}
function renderDot(plan){if(!plan||plan.result!=='PREBUILD_TWIN_READY')return 'digraph prebuild { label="NO PREBUILD PLAN"; }';const lines=['digraph prebuild {','  rankdir=LR;','  graph [label="'+String(plan.routeRecipe.id).replace(/"/g,'')+'", labelloc=t];','  node [shape=box];'];for(const n of plan.nodes){const label=`${n.role}\\n${n.boundLanguageId||'UNBOUND'}\\n${n.optional?'optional':'required'}`;lines.push(`  "${n.role}" [label="${label}"];`)}for(const e of plan.edges){const label=`${e.routeClassCandidates.join('|')}\\n${e.state}`;lines.push(`  "${e.from}" -> "${e.to}" [label="${label}"];`)}lines.push('}');return lines.join('\n')}
function renderSvg(plan){
 if(!plan||plan.result!=='PREBUILD_TWIN_READY')return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 120"><text x="20" y="60">NO PREBUILD PLAN</text></svg>';
 const cols=3,nodeW=240,nodeH=72,gapX=70,gapY=80,startX=40,startY=120;
 const positions=new Map();plan.nodes.forEach((n,i)=>positions.set(n.role,{x:startX+(i%cols)*(nodeW+gapX),y:startY+Math.floor(i/cols)*(nodeH+gapY)}));
 const rows=Math.max(1,Math.ceil(plan.nodes.length/cols)),width=startX*2+cols*nodeW+(cols-1)*gapX,height=startY+rows*nodeH+(rows-1)*gapY+100;
 const edgeLines=plan.edges.map(e=>{const a=positions.get(e.from),b=positions.get(e.to);if(!a||!b)return'';const x1=a.x+nodeW/2,y1=a.y+nodeH/2,x2=b.x+nodeW/2,y2=b.y+nodeH/2;const dash=e.state==='BOUND_ROUTE_SUPPORTED'?'':' stroke-dasharray="7 5"';return `<g><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1.5"${dash}/><text x="${(x1+x2)/2}" y="${(y1+y2)/2-6}" text-anchor="middle" font-size="10">${esc(e.routeClassCandidates[0]||'route')}</text></g>`}).join('');
 const nodeMarkup=plan.nodes.map(n=>{const p=positions.get(n.role);const fill=n.boundLanguageId?'#e7f6ea':n.optional?'#f4f4f4':'#fff4d8';return `<g><rect x="${p.x}" y="${p.y}" width="${nodeW}" height="${nodeH}" rx="8" fill="${fill}" stroke="currentColor"/><text x="${p.x+12}" y="${p.y+24}" font-size="14" font-weight="700">${esc(n.role)}</text><text x="${p.x+12}" y="${p.y+45}" font-size="12">${esc(n.boundLanguageId||'UNBOUND')}</text><text x="${p.x+12}" y="${p.y+62}" font-size="10">${esc(n.optional?'optional':'required')} · ${esc(n.state)}</text></g>`}).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Prebuild twin for ${esc(plan.routeRecipe.id)}"><rect width="100%" height="100%" fill="white"/><text x="40" y="38" font-size="22" font-weight="700">Prebuild Twin · ${esc(plan.routeRecipe.id)}</text><text x="40" y="66" font-size="13">${esc(plan.simulation.state)} · runtime behavior remains UNKNOWN</text><text x="40" y="88" font-size="11">plan ${esc(plan.planDigest.slice(0,16))}</text>${edgeLines}${nodeMarkup}</svg>`;
}
function preview(input={}){const plan=buildPlan(input);if(plan.result!=='PREBUILD_TWIN_READY')return{schema:'axm.code.prebuild-preview.v1',result:'NO_PREVIEW',plan,authority:'NONE'};return{schema:'axm.code.prebuild-preview.v1',result:'PREVIEW_READY',plan,summary:{recipeId:plan.routeRecipe.id,nodeCount:plan.nodes.length,edgeCount:plan.edges.length,holds:[...plan.simulation.holds],sourceGenerationReady:plan.simulation.sourceGenerationReady},dot:renderDot(plan),svg:renderSvg(plan),authority:'NONE'}}
function snapshot(){const body={schema:'axm.code.prebuild-twin-snapshot.v1',version:'1.0.0',topologyCount:TOPOLOGY_SOURCE.topologies.length,topologyDigest:hash(TOPOLOGY_SOURCE),routeKnowledgeSnapshot:routes.snapshot().snapshotSha256,authority:'NONE'};return{...body,snapshotSha256:hash(body)}}
module.exports={buildPlan,preview,renderDot,renderSvg,snapshot};
