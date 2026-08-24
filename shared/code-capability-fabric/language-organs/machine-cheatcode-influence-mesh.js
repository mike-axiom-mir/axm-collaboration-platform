'use strict';
const crypto=require('crypto');
const fabric=require('./machine-cheatcode-fabric.js');

const MAX_DEPTH=3;
const MAX_SEEDS=20;
const MAX_INFLUENCE_CANDIDATES=80;
const AUTHORITY=Object.freeze({workspaceRead:false,workspaceMutation:false,toolExecution:false,network:false,install:false,promotion:false,canon:false});
const PHASE_LINKS=Object.freeze({
  'parse':['symbols','dependencies','types-state'],
  'symbols':['dependencies','types-state','rewrite-safety'],
  'dependencies':['types-state','control-effects','verification','discovery'],
  'types-state':['control-effects','rewrite-safety','performance-build','debugging'],
  'control-effects':['rewrite-safety','verification','debugging'],
  'rewrite-safety':['verification','debugging','discovery'],
  'verification':['performance-build','debugging','discovery'],
  'performance-build':['debugging','discovery','verification'],
  'debugging':['verification','discovery','types-state'],
  'discovery':['verification','debugging','dependencies']
});
function canon(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return`[${v.map(canon).join(',')}]`;return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`}
function hash(v){return crypto.createHash('sha256').update(v).digest('hex')}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x)}return v}
function norm(v){return String(v).trim().toLowerCase()}
function overlap(a,b){const x=new Set((a||[]).map(norm));return [...new Set((b||[]).map(norm))].filter(v=>x.has(v));}
function edgeReasons(a,b){const reasons=[];
  const native=overlap(a.nativeBindings,b.nativeBindings); if(native.length)reasons.push({kind:'SHARED_NATIVE_BINDING',values:native.slice(0,3),weight:4});
  const verifier=overlap(a.verifierCandidates,b.verifierCandidates); if(verifier.length)reasons.push({kind:'SHARED_VERIFIER',values:verifier.slice(0,2),weight:2});
  if((PHASE_LINKS[a.phase]||[]).includes(b.phase))reasons.push({kind:'PHASE_SUCCESSION',values:[`${a.phase}->${b.phase}`],weight:3});
  if(a.invalidates.some(x=>b.reads.includes(x)))reasons.push({kind:'INVALIDATION_RECHECK',values:a.invalidates.filter(x=>b.reads.includes(x)).slice(0,3),weight:5});
  if(a.emits===b.emits)reasons.push({kind:'SAME_EVIDENCE_CLASS',values:[a.emits],weight:1});
  if(a.phase!==b.phase&&a.opcode.split('_').some(tok=>tok.length>4&&b.opcode.includes(tok)))reasons.push({kind:'OPCODE_CONCEPT_BRIDGE',values:[],weight:2});
  return reasons;
}
function buildMesh(languageId){const bank=fabric.build(languageId);if(!bank)return null;const rules=bank.rules;const edges=[];
  for(let i=0;i<rules.length;i++)for(let j=0;j<rules.length;j++){
    if(i===j)continue; const a=rules[i],b=rules[j],reasons=edgeReasons(a,b); let weight=reasons.reduce((n,r)=>n+r.weight,0);
    const ring=(j===(i+1)%rules.length)||(j===(i+7)%rules.length); if(ring){reasons.push({kind:'DETERMINISTIC_CREATIVE_BRIDGE',values:[`${a.rank}->${b.rank}`],weight:1});weight+=1;}
    if(weight>=4||ring)edges.push({from:a.id,to:b.id,weight,reasons:reasons.map(({weight,...r})=>r),truthEffect:'NONE',activationEffect:'SOFT_CANDIDATE_ONLY'});
  }
  const outgoing={};const incoming={};for(const r of rules){outgoing[r.id]=[];incoming[r.id]=[];}for(const e of edges){outgoing[e.from].push(e);incoming[e.to].push(e);}for(const id of Object.keys(outgoing)){outgoing[id].sort((a,b)=>b.weight-a.weight||a.to.localeCompare(b.to));incoming[id].sort((a,b)=>b.weight-a.weight||a.from.localeCompare(b.from));}
  // Guarantee every rule participates in the mesh without inventing semantic truth.
  for(const r of rules){if(!outgoing[r.id].length||!incoming[r.id].length)throw Error(`CHEATCODE_MESH_ISOLATED_RULE:${languageId}:${r.id}`);}
  const nodes=rules.map(r=>({ruleId:r.id,rank:r.rank,phase:r.phase,opcode:r.opcode,outDegree:outgoing[r.id].length,inDegree:incoming[r.id].length}));
  const body={schema:'axm.code.machine-cheatcode-influence-mesh.v1',status:'TEST',languageId,bankSha256:bank.bankSha256,nodeCount:nodes.length,edgeCount:edges.length,maxPropagationDepth:MAX_DEPTH,nodes,edges,truth:{influenceIsActivation:false,influenceIsEvidence:false,moreInfluenceIsNotMoreTruth:true,semanticCorrectnessClaimed:false,runtimeCorrectnessClaimed:false},authority:AUTHORITY};return freeze({...body,meshSha256:hash(canon(body))});}
function propagate({languageId,observation={},maxDepth=MAX_DEPTH}={}){const bank=fabric.build(languageId),mesh=buildMesh(languageId);if(!bank||!mesh)return{result:'UNKNOWN_LANGUAGE_CHEATCODE_MESH',languageId:languageId||null};const hard=fabric.evaluate({languageId,observation});const byId=new Map(bank.rules.map(r=>[r.id,r]));const outgoing=new Map();for(const e of mesh.edges){if(!outgoing.has(e.from))outgoing.set(e.from,[]);outgoing.get(e.from).push(e);}for(const xs of outgoing.values())xs.sort((a,b)=>b.weight-a.weight||a.to.localeCompare(b.to));
  const seeds=hard.matches.slice(0,MAX_SEEDS).map(m=>({ruleId:m.ruleId,depth:0,path:[m.ruleId],source:'HARD_ACTIVATION'}));const queue=[...seeds],visited=new Set(seeds.map(x=>`0:${x.ruleId}`)),candidates=new Map();
  while(queue.length){const cur=queue.shift();if(cur.depth>=Math.max(0,Math.min(Number(maxDepth)||MAX_DEPTH,MAX_DEPTH)))continue;for(const edge of (outgoing.get(cur.ruleId)||[]).slice(0,8)){if(cur.path.includes(edge.to))continue;const target=byId.get(edge.to);if(!target)continue;const nextDepth=cur.depth+1;const key=`${nextDepth}:${edge.to}`;const path=[...cur.path,edge.to];const candidate={ruleId:edge.to,rank:target.rank,phase:target.phase,opcode:target.opcode,depth:nextDepth,fromRuleId:cur.ruleId,edgeWeight:edge.weight,reasons:edge.reasons,path,state:'INFLUENCE_CANDIDATE_REQUIRES_EVIDENCE',truthEffect:'NONE',authority:'NONE'};const prev=candidates.get(edge.to);if(!prev||candidate.depth<prev.depth||candidate.edgeWeight>prev.edgeWeight)candidates.set(edge.to,candidate);if(!visited.has(key)){visited.add(key);queue.push({ruleId:edge.to,depth:nextDepth,path,source:'SOFT_INFLUENCE'});}if(candidates.size>=MAX_INFLUENCE_CANDIDATES)break;}if(candidates.size>=MAX_INFLUENCE_CANDIDATES)break;}
  for(const m of hard.matches)candidates.delete(m.ruleId);const influenced=[...candidates.values()].sort((a,b)=>a.depth-b.depth||b.edgeWeight-a.edgeWeight||a.rank-b.rank);return freeze({schema:'axm.code.machine-cheatcode-influence-report.v1',result:'INFLUENCE_REPORT_READY_NO_ACTION',languageId,bankSha256:bank.bankSha256,meshSha256:mesh.meshSha256,hardActivationCount:hard.matchCount,hardActivations:hard.matches,influenceCandidateCount:influenced.length,influenceCandidates:influenced,propagationDepthLimit:MAX_DEPTH,truth:{hardActivationDerivedFromObservation:true,softInfluenceRequiresEvidence:true,influenceDoesNotUpgradeConfidence:true,moreInfluenceIsNotMoreTruth:true},authority:AUTHORITY});}
function meshSnapshot(){const entries=fabric.all().map(b=>{const m=buildMesh(b.languageId);return{languageId:b.languageId,bankSha256:b.bankSha256,meshSha256:m.meshSha256,nodeCount:m.nodeCount,edgeCount:m.edgeCount};});const body={schema:'axm.code.machine-cheatcode-influence-mesh-snapshot.v1',meshCount:entries.length,totalNodeCount:entries.reduce((n,x)=>n+x.nodeCount,0),totalEdgeCount:entries.reduce((n,x)=>n+x.edgeCount,0),entries};return freeze({...body,snapshotSha256:hash(canon(body))});}
module.exports={MAX_DEPTH,buildMesh,propagate,meshSnapshot};
