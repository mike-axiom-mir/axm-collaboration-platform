'use strict';
const crypto=require('crypto');
const ATLAS=require('./code-route-knowledge.json');
const registry=require('./registry.js');
function canon(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return`[${v.map(canon).join(',')}]`;return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`}
function hash(v){return crypto.createHash('sha256').update(canon(v)).digest('hex')}
function norm(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,' ')}
function endpointMatches(endpoint,organ){if(!organ)return false;if(endpoint===organ.languageId)return true;if(endpoint===`family:${organ.family}`)return true;return false}
function familyRuleMatches(rule,a,b){return rule.sourceFamilies.includes(a.family)&&rule.destinationFamilies.includes(b.family)}
function directPairRoutes(a,b){
 const routes=[];
 for(const r of ATLAS.explicitBridges){
   if(endpointMatches(r.source,a)&&endpointMatches(r.destination,b))routes.push({source:'EXPLICIT_BRIDGE',orientation:'DECLARED',...r});
   if(String(r.direction||'').startsWith('BIDIRECTIONAL')&&endpointMatches(r.source,b)&&endpointMatches(r.destination,a))routes.push({source:'EXPLICIT_BRIDGE',orientation:'REVERSED_BIDIRECTIONAL',...r});
 }
 for(const r of ATLAS.familyRules)if(familyRuleMatches(r,a,b))routes.push({source:'FAMILY_RULE',orientation:'DECLARED',...r});
 return routes;
}
function relate({languageA,languageB,purposeTags=[]}={}){
 const a=registry.getByLanguageId(languageA),b=registry.getByLanguageId(languageB);
 if(!a||!b)return{schema:'axm.code-route-relation.v1',result:'UNKNOWN_LANGUAGE',languageA:languageA||null,languageB:languageB||null,unknown:[!a?languageA:null,!b?languageB:null].filter(Boolean),routes:[],authority:'NONE'};
 const forward=directPairRoutes(a,b).map(x=>({...x,queryDirection:`${a.languageId}->${b.languageId}`}));
 const reverse=directPairRoutes(b,a).map(x=>({...x,queryDirection:`${b.languageId}->${a.languageId}`,relevantToPair:true}));
 const wanted=new Set((purposeTags||[]).map(norm).filter(Boolean));
 const score=x=>{const text=norm([...(x.purpose||[]),x.artifact||'',x.warning||''].join(' '));let n=0;for(const t of wanted)if(text.includes(t))n+=5;return n};
 const routes=[...forward,...reverse].sort((x,y)=>score(y)-score(x)||x.id.localeCompare(y.id));
 return{schema:'axm.code-route-relation.v1',result:routes.length?'ROUTES_FOUND':'NO_KNOWN_DIRECT_ROUTE',languageA:a.languageId,languageB:b.languageId,families:[a.family,b.family],purposeTags:[...wanted],routes:routes.map(x=>({...x,score:score(x),authority:'NONE'})),note:routes.length?'Routes describe boundaries, not proof that a concrete adapter/toolchain is installed.':'Absence of a direct route does not mean the languages cannot coexist; process/file/network boundaries may still connect them.',authority:'NONE'};
}
function recipeScore(recipe,goal){const g=norm(goal);let score=0;for(const tag of recipe.goalTags){const t=norm(tag);if(g===t)score=Math.max(score,100+t.length);else if(g.includes(t)||t.includes(g))score=Math.max(score,60+Math.min(g.length,t.length));else{const parts=t.split(/[^a-z0-9]+/).filter(Boolean);score=Math.max(score,parts.reduce((n,p)=>n+(g.includes(p)?3:0),0))}}return score}
function roleCandidates(role,activeSet,preferredSet){
 const xs=registry.all().filter(o=>role.families.includes(o.family));
 const score=o=>{let n=0;if(activeSet.has(o.languageId))n+=100;if(preferredSet.has(o.languageId))n+=60;const pi=(role.preferredLanguages||[]).indexOf(o.languageId);if(pi>=0)n+=40-pi;return n};
 return xs.map(o=>({languageId:o.languageId,organId:o.organId,family:o.family,kind:o.kind,score:score(o),active:activeSet.has(o.languageId),preferred:preferredSet.has(o.languageId),toolchainCandidates:[...o.toolchainCandidates]})).sort((a,b)=>b.score-a.score||a.languageId.localeCompare(b.languageId));
}
function planGoal({goal,activeLanguageIds=[],preferredLanguageIds=[],topRecipes=3}={}){
 const g=norm(goal);if(!g)return{schema:'axm.code-build-route-plan.v1',result:'GOAL_REQUIRED',recipes:[],authority:'NONE'};
 const activeSet=new Set((activeLanguageIds||[]).map(norm)),preferredSet=new Set((preferredLanguageIds||[]).map(norm));
 const unknownActive=[...activeSet].filter(x=>!registry.getByLanguageId(x));
 const ranked=ATLAS.buildRecipes.map(r=>({recipe:r,score:recipeScore(r,g)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.recipe.id.localeCompare(b.recipe.id)).slice(0,Math.max(1,Math.min(5,topRecipes)));
 if(!ranked.length)return{schema:'axm.code-build-route-plan.v1',result:'NO_RECIPE_MATCH',goal:g,unknownActive,recipes:[],fallback:'Use discipline/grammar discovery to define a new route recipe candidate; do not guess a stack.',authority:'NONE'};
 const recipes=ranked.map(({recipe,score})=>{
   const roles=recipe.roles.map(role=>{const candidates=roleCandidates(role,activeSet,preferredSet);const active=candidates.filter(x=>x.active);return{...role,status:active.length?'ACTIVE_MATCH':candidates.length?'CANDIDATES_AVAILABLE':'NO_REGISTERED_LANGUAGE_FOR_ROLE',selected:null,candidates:candidates.slice(0,12),note:active.length?'Existing active language(s) satisfy this role; no replacement is implied.':'Candidate order is deterministic guidance, not architecture authority.'}});
   return{id:recipe.id,score,why:recipe.why,routeClasses:[...recipe.routeClasses],roles,missingRequiredRoles:roles.filter(r=>!r.optional&&r.status==='NO_REGISTERED_LANGUAGE_FOR_ROLE').map(r=>r.role),activeRoleCoverage:roles.filter(r=>r.status==='ACTIVE_MATCH').map(r=>r.role)};
 });
 return{schema:'axm.code-build-route-plan.v1',result:'ROUTE_RECIPES_FOUND',goal:g,activeLanguageIds:[...activeSet].sort(),preferredLanguageIds:[...preferredSet].sort(),unknownActive,recipes,truth:{planOnly:true,languageSwitched:false,dependenciesInstalled:false,toolchainExecuted:false,workspaceRead:false,workspaceWritten:false,semanticCorrectnessClaimed:false,bestArchitectureClaimed:false},authority:'NONE'};
}
function explainLanguage(languageId){
 const o=registry.getByLanguageId(languageId);if(!o)return{schema:'axm.code-route-language-view.v1',result:'UNKNOWN_LANGUAGE',languageId:languageId||null,authority:'NONE'};
 const outbound=ATLAS.explicitBridges.filter(r=>endpointMatches(r.source,o));const inbound=ATLAS.explicitBridges.filter(r=>endpointMatches(r.destination,o));
 const familyOutbound=ATLAS.familyRules.filter(r=>r.sourceFamilies.includes(o.family));const familyInbound=ATLAS.familyRules.filter(r=>r.destinationFamilies.includes(o.family));
 const recipes=ATLAS.buildRecipes.filter(r=>r.roles.some(role=>role.families.includes(o.family)|| (role.preferredLanguages||[]).includes(o.languageId))).map(r=>({id:r.id,roles:r.roles.filter(role=>role.families.includes(o.family)||(role.preferredLanguages||[]).includes(o.languageId)).map(x=>x.role),why:r.why}));
 return{schema:'axm.code-route-language-view.v1',result:'LANGUAGE_ROUTE_VIEW',languageId:o.languageId,organId:o.organId,family:o.family,kind:o.kind,toolchainCandidates:[...o.toolchainCandidates],outboundExplicit:outbound,inboundExplicit:inbound,outboundFamilyRules:familyOutbound,inboundFamilyRules:familyInbound,buildRecipes:recipes,authority:'NONE'};
}
function snapshot(){const body={schema:'axm.code-route-knowledge-snapshot.v1',version:ATLAS.version,organCount:registry.all().length,routeClassCount:Object.keys(ATLAS.routeClasses).length,explicitBridgeCount:ATLAS.explicitBridges.length,familyRuleCount:ATLAS.familyRules.length,buildRecipeCount:ATLAS.buildRecipes.length,atlasSha256:hash(ATLAS),authority:'NONE'};return{...body,snapshotSha256:hash(body)}}
module.exports={relate,planGoal,explainLanguage,snapshot,directPairRoutes};
