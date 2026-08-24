'use strict';
const crypto=require('crypto');
const registry=require('./registry.js');
const AUTHORITY=Object.freeze({workspaceRead:false,workspaceMutation:false,toolExecution:false,network:false,install:false,promotion:false,canon:false});
const STATUSES=new Set(['PASS','FAIL','UNKNOWN','NOT_APPLICABLE']);
function canon(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return`[${v.map(canon).join(',')}]`;return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`}
function hash(v){return crypto.createHash('sha256').update(canon(v)).digest('hex')}
function norm(v){return String(v||'').trim().toLowerCase()}
function stableId(v){return norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'verifier'}
function classifyFocus(v){const n=norm(v);if(/test|spec|fixture|regression/.test(n))return'TEST_REGRESSION';if(/clippy|lint|tidy|analy|static|semgrep|codeql/.test(n))return'STATIC_ANALYSIS';if(/type|check|compile|compiler|validate|validator|rustc|javac|tsc|elaborat|parse|interpreter/.test(n))return'NATIVE_VALIDATE';return'NATIVE_VERIFIER'}
function buildPolicy({languageId,mode='GUARDED',existingTests=false,boundaryChanges=[]}={}){
 const organ=registry.getByLanguageId(languageId),profile=registry.grammarProfile(languageId);
 if(!organ||!profile)return{schema:'axm.code.candidate-admission-policy.v1',result:'UNKNOWN_LANGUAGE',languageId:languageId||null,checks:[],authority:'NONE'};
 const strict=String(mode||'GUARDED').toUpperCase()==='STRICT';
 const checks=[{id:'structural-parse',class:'STRUCTURAL_PARSE',required:true,reason:'Every candidate must be structurally parseable by the bound grammar before deeper checks.',verifierCandidates:['grammar-bound structural parser'],evidenceCeiling:'STRUCTURE_ONLY'}];
 const seen=new Set();
 for(const raw of profile.verification.focus||[]){const label=String(raw),kind=classifyFocus(label),key=`${kind}:${norm(label)}`;if(seen.has(key))continue;seen.add(key);let required=false;if(kind==='NATIVE_VALIDATE')required=true;else if(kind==='STATIC_ANALYSIS')required=strict;else if(kind==='TEST_REGRESSION')required=!!existingTests||strict;checks.push({id:`${kind.toLowerCase().replace(/_/g,'-')}:${stableId(label)}`,class:kind,required,reason:kind==='NATIVE_VALIDATE'?'Grammar-native compiler/type/validator evidence is part of the guarded floor.':kind==='STATIC_ANALYSIS'?'Static analysis reduces bug risk beyond parse/compile evidence but can have false positives.':'Existing regression tests become required when they exist or strict admission is requested.',verifierCandidates:[label],evidenceCeiling:kind==='TEST_REGRESSION'?'OBSERVED_TEST_BEHAVIOR':kind==='STATIC_ANALYSIS'?'STATIC_DIAGNOSTIC':'NATIVE_TOOL_DIAGNOSTIC'});}
 for(const change of boundaryChanges||[]){const id=stableId(change.id||change.routeClass||change.boundary||JSON.stringify(change));checks.push({id:`route-boundary:${id}`,class:'ROUTE_BOUNDARY',required:true,reason:'Changed cross-language/runtime boundaries require explicit compatibility evidence.',verifierCandidates:[String(change.verifier||change.routeClass||change.boundary||'boundary integration verifier')],evidenceCeiling:'BOUNDARY_INTEGRATION'});}
 const core={schema:'axm.code.candidate-admission-policy.v1',version:'1.0.0',result:'ADMISSION_POLICY_READY',languageId:organ.languageId,organId:organ.organId,organDigest:organ.sha256,grammarProfileDigest:profile.profileSha256,mode:strict?'STRICT':'GUARDED',checks,truth:{unknownIsNotPass:true,parsePassIsNotSemanticCorrectness:true,compilePassIsNotRuntimeCorrectness:true,staticAnalysisCanFalsePositive:true,testPassIsNotUniversalCorrectness:true,admissibleIsNotPromoted:true},authority:AUTHORITY};return{...core,policyDigest:hash(core)}
}
function normalizeObservation(o){const status=String(o&&o.status||'UNKNOWN').toUpperCase();if(!STATUSES.has(status))throw Error(`ADMISSION_OBSERVATION_STATUS_INVALID:${status}`);return{checkId:String(o.checkId||''),status,verifierId:String(o.verifierId||''),toolVersion:o.toolVersion==null?null:String(o.toolVersion),evidenceDigest:o.evidenceDigest==null?null:String(o.evidenceDigest),note:o.note==null?null:String(o.note)}
}
function evaluate({languageId,candidateDigest,mode='GUARDED',existingTests=false,boundaryChanges=[],observations=[]}={}){
 const policy=buildPolicy({languageId,mode,existingTests,boundaryChanges});if(policy.result!=='ADMISSION_POLICY_READY')return{schema:'axm.code.candidate-admission-report.v1',result:'NO_ADMISSION_POLICY',policy,authority:'NONE'};
 const normalized=(observations||[]).map(normalizeObservation);const byId=new Map();for(const o of normalized){if(!policy.checks.some(c=>c.id===o.checkId))continue;if(byId.has(o.checkId))throw Error(`ADMISSION_DUPLICATE_OBSERVATION:${o.checkId}`);byId.set(o.checkId,o)}
 const results=policy.checks.map(check=>{const obs=byId.get(check.id)||{checkId:check.id,status:'UNKNOWN',verifierId:'',toolVersion:null,evidenceDigest:null,note:null};return{...check,observation:obs}});
 const requiredFailures=results.filter(x=>x.required&&x.observation.status==='FAIL');
 const requiredUnknown=results.filter(x=>x.required&&['UNKNOWN','NOT_APPLICABLE'].includes(x.observation.status));
 const advisoryFailures=results.filter(x=>!x.required&&x.observation.status==='FAIL');
 let result='ADMISSIBLE_CANDIDATE_NOT_PROMOTED';if(requiredFailures.length)result='REJECTED_CANDIDATE';else if(requiredUnknown.length)result='HELD_IN_QUARANTINE';
 const core={schema:'axm.code.candidate-admission-report.v1',version:'1.0.0',result,languageId:policy.languageId,candidateDigest:candidateDigest||null,policyDigest:policy.policyDigest,requiredFailureIds:requiredFailures.map(x=>x.id),requiredUnknownIds:requiredUnknown.map(x=>x.id),advisoryFailureIds:advisoryFailures.map(x=>x.id),checks:results,truth:{candidateExecutedByThisModule:false,workspaceMutation:false,admittedMeansBugFree:false,admittedMeansRuntimeCorrect:false,admittedMeansPromoted:false,unknownIsNotPass:true},nextGate:result==='ADMISSIBLE_CANDIDATE_NOT_PROMOTED'?'SEPARATE_REVIEW_MERGE_OR_EXECUTION_AUTHORITY':result==='HELD_IN_QUARANTINE'?'PROVIDE_REQUIRED_EVIDENCE':'REPAIR_CANDIDATE_AND_RECHECK',authority:AUTHORITY};return{...core,reportDigest:hash(core)}
}
function makePassingFixtureObservations(policy){return policy.checks.filter(c=>c.required).map(c=>({checkId:c.id,status:'PASS',verifierId:c.verifierCandidates[0]||'fixture-verifier',toolVersion:'fixture',evidenceDigest:'sha256:'+crypto.createHash('sha256').update(c.id).digest('hex')}))}
module.exports={buildPolicy,evaluate,classifyFocus,makePassingFixtureObservations};
