'use strict';
const crypto=require('crypto');
const grammar=require('./grammar-profile-registry.js');
function canon(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return`[${v.map(canon).join(',')}]`;return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`}
function hash(v){return crypto.createHash('sha256').update(typeof v==='string'?v:canon(v)).digest('hex')}
function normShape(v){if(!Array.isArray(v)||!v.length||v.length>128)throw Error('INVALID_TEMPLATE_SHAPE');return v.map(x=>String(x).trim()).filter(Boolean)}
function normalizeSample(s){
  if(!s||!grammar.getByLanguageId(s.languageId))throw Error('UNKNOWN_OR_MISSING_LANGUAGE');
  const shape=normShape(s.shape);const projectDigest=String(s.projectDigest||'').trim();if(!projectDigest)throw Error('PROJECT_DIGEST_REQUIRED');
  const body={languageId:s.languageId,intent:String(s.intent||'reuse'),patternKind:String(s.patternKind||'STRUCTURAL'),projectDigest,shape,contextTags:(s.contextTags||[]).map(String).slice(0,24),verifierEvidence:(s.verifierEvidence||[]).map(String).slice(0,16)};
  return {...body,sampleSha256:hash(body)};
}
function antiUnify(shapes){
  const n=Math.max(...shapes.map(s=>s.length));const out=[];const holes=[];
  for(let i=0;i<n;i++){
    const vals=shapes.map(s=>s[i]===undefined?'__MISSING__':s[i]);
    if(vals.every(v=>v===vals[0]))out.push({kind:'EXACT',value:vals[0]});
    else {const id=`H${holes.length+1}`;out.push({kind:'HOLE',id});holes.push({id,type:'STRUCTURAL_FRAGMENT',position:i,observedValues:[...new Set(vals)].slice(0,12)});}
  }
  return {generalizedShape:out,holes};
}
function mine(samples,{minSupport=3,minProjectDiversity=2,maxHoles=12}={}){
  const xs=samples.map(normalizeSample);const groups=new Map();
  for(const s of xs){const key=[s.languageId,s.intent,s.patternKind,s.shape.length].join('|');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s)}
  const candidates=[];
  for(const group of groups.values()){
    const projects=new Set(group.map(x=>x.projectDigest));
    if(group.length<minSupport||projects.size<minProjectDiversity)continue;
    const g=antiUnify(group.map(x=>x.shape));if(g.holes.length>maxHoles)continue;
    const body={schema:'axm.code.mined-template-candidate.v1',lane:'PATTERN_NURSERY',candidateState:'MINED_UNVERIFIED',languageId:group[0].languageId,intent:group[0].intent,patternKind:group[0].patternKind,support:group.length,projectDiversity:projects.size,generalizedShape:g.generalizedShape,holes:g.holes,contextTags:[...new Set(group.flatMap(x=>x.contextTags))].slice(0,32),sampleDigests:group.map(x=>x.sampleSha256).sort(),requiresAdmissionEvidence:['STRUCTURAL_PARSE_PASS','NEGATIVE_FIXTURE_PASS','EXPLICIT_REVIEW_DECISION'],automaticPromotion:false,authority:'NONE'};
    candidates.push({...body,candidateSha256:hash(body)});
  }
  return {schema:'axm.code.template-pattern-mining-report.v1',sampleCount:xs.length,candidateCount:candidates.length,candidates:candidates.sort((a,b)=>b.support-a.support||b.projectDiversity-a.projectDiversity||a.candidateSha256.localeCompare(b.candidateSha256)),frequencyIsNotCorrectness:true,authority:'NONE'};
}
function prepareAdmission(candidate,evidence=[]){
  const ev=new Set(evidence.map(String));const missing=candidate.requiresAdmissionEvidence.filter(x=>!ev.has(x));
  return {schema:'axm.code.template-admission-review.v1',candidateSha256:candidate.candidateSha256,result:missing.length?'ADMISSION_HELD':'ADMISSION_REVIEW_READY',missingEvidence:missing,automaticPromotion:false,authority:'NONE'};
}
module.exports={normalizeSample,antiUnify,mine,prepareAdmission};
