'use strict';
const {now,safeId,sha256,clone,text}=require('./utils');

function typeOf(value){if(value===null)return'null';if(Array.isArray(value))return'array';return typeof value;}
function pathGet(obj,path){return String(path||'').split('.').filter(Boolean).reduce((v,k)=>v&&Object.prototype.hasOwnProperty.call(v,k)?v[k]:undefined,obj);}
function dangerHits(value,path='root',out=[]){
  if(typeof value==='string'){
    const s=value.toLowerCase();
    const patterns=['<script','javascript:','powershell -enc','rm -rf','child_process','eval(','exec(','curl http','wget http','ignore previous instructions'];
    for(const p of patterns)if(s.includes(p))out.push({path,pattern:p});
  }else if(Array.isArray(value))value.forEach((v,i)=>dangerHits(v,path+'['+i+']',out));
  else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>dangerHits(v,path+'.'+k,out));
  return out;
}
function validateContract(value,contract={}){
  const issues=[];
  const required=Array.isArray(contract.required_fields)?contract.required_fields:[];
  for(const field of required)if(pathGet(value,field)===undefined)issues.push({kind:'missing_field',path:field,severity:'high'});
  const types=contract.field_types&&typeof contract.field_types==='object'?contract.field_types:{};
  for(const [field,expected] of Object.entries(types)){
    const found=pathGet(value,field);if(found!==undefined&&typeOf(found)!==expected)issues.push({kind:'wrong_type',path:field,expected,actual:typeOf(found),severity:'high'});
  }
  const enums=contract.enums&&typeof contract.enums==='object'?contract.enums:{};
  for(const [field,allowed] of Object.entries(enums)){
    const found=pathGet(value,field);if(found!==undefined&&!allowed.includes(found))issues.push({kind:'enum_violation',path:field,allowed,actual:found,severity:'high'});
  }
  if(contract.additional_properties===false&&value&&typeof value==='object'&&!Array.isArray(value)){
    const allowed=new Set([...(contract.required_fields||[]).map(x=>String(x).split('.')[0]),...Object.keys(types).map(x=>x.split('.')[0]),...Object.keys(enums).map(x=>x.split('.')[0]),...(contract.allowed_fields||[])]);
    for(const key of Object.keys(value))if(!allowed.has(key))issues.push({kind:'unknown_field',path:key,severity:'medium'});
  }
  return issues;
}
function semanticChecks(value,rules={}){
  const issues=[];
  const evidence=Array.isArray(value&&value.evidence_refs)?value.evidence_refs:[];
  const status=String(value&&value.status||'').toUpperCase();
  if(rules.require_evidence_for_verified!==false&&['VERIFIED','APPROVED','PROMOTE','PASS'].includes(status)&&!evidence.length)issues.push({kind:'unsupported_status',path:'status',severity:'critical',detail:'verified/approved-like status lacks evidence_refs'});
  if(value&&value.permission&&String(value.permission.state||'').toUpperCase().includes('DENIED')&&value.action)issues.push({kind:'permission_contradiction',path:'action',severity:'critical'});
  if(value&&value.automatic_promotion===true)issues.push({kind:'authority_escalation',path:'automatic_promotion',severity:'critical'});
  if(value&&value.execute===true&&!value.permission_receipt)issues.push({kind:'execution_without_permission',path:'execute',severity:'critical'});
  if(value&&value.claim&&value.uncertainty===undefined)issues.push({kind:'missing_uncertainty',path:'uncertainty',severity:'medium'});
  return issues;
}
function grade(input={}){
  const submission=typeof input.submission==='string'?input.submission:JSON.stringify(input.submission);
  const report={schema:'axm.mirror.structured-literacy-grade/v1',grade_id:safeId('structured-grade'),track:'structured_json',syntax:{pass:false,error:null},contract:{pass:false,issues:[]},semantics:{pass:false,issues:[]},safety:{pass:false,hits:[]},round_trip:{pass:false},verdict:'REPAIR',created_at:now()};
  let value;
  try{value=JSON.parse(submission);report.syntax.pass=true;}catch(e){report.syntax.error=text(e.message,500);report.hash=sha256({...report,hash:undefined});return report;}
  report.contract.issues=validateContract(value,input.contract||{});report.contract.pass=!report.contract.issues.some(x=>['high','critical'].includes(x.severity));
  report.semantics.issues=semanticChecks(value,input.rules||{});report.semantics.pass=!report.semantics.issues.some(x=>['high','critical'].includes(x.severity));
  report.safety.hits=dangerHits(value);report.safety.pass=report.safety.hits.length===0;
  try{report.round_trip.pass=JSON.stringify(JSON.parse(JSON.stringify(value)))===JSON.stringify(value);}catch(_){report.round_trip.pass=false;}
  const all=[...report.contract.issues,...report.semantics.issues];
  report.verdict=all.some(x=>x.severity==='critical')||!report.safety.pass?'REJECT':report.syntax.pass&&report.contract.pass&&report.semantics.pass&&report.round_trip.pass?'PASS':'REPAIR';
  report.normalized=value;report.summary={issue_count:all.length,safety_hit_count:report.safety.hits.length,truth_boundary:'Valid JSON is not necessarily valid truth.'};
  report.hash=sha256({...report,hash:undefined});return clone(report);
}
module.exports={grade,validateContract,semanticChecks,dangerHits,typeOf,pathGet};
