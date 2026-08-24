'use strict';
const crypto=require('crypto');
const eyes=require('./specialist-eye-registry.js');

const FIELDS=['goals','capabilities','gaps','constraints','risks','requirements','paths','notes'];
const MAX_ITEMS=256,MAX_TEXT=4000;
const STOP=new Set(['the','and','or','for','with','from','into','code','system','application','language','runtime','data','build','service','module','model','tool','tools','work']);
const STATE_WEIGHT={NATIVE_REVIEW:4,DISCOVERY_CANDIDATE:3,WEAK_SIGNAL:2,NOT_RELEVANT:1};
function canon(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return`[${v.map(canon).join(',')}]`;return`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`}
function hash(v){return crypto.createHash('sha256').update(v).digest('hex')}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x)}return v}
function arr(v,name){if(v==null)return[];if(!Array.isArray(v))throw Error(`OBSERVATION_FIELD_NOT_ARRAY:${name}`);if(v.length>MAX_ITEMS)throw Error(`OBSERVATION_FIELD_TOO_MANY_ITEMS:${name}`);return v.map((x,i)=>{if(typeof x!=='string')throw Error(`OBSERVATION_ITEM_NOT_STRING:${name}:${i}`);if(x.length>MAX_TEXT)throw Error(`OBSERVATION_ITEM_TOO_LONG:${name}:${i}`);return x.trim()}).filter(Boolean)}
function normalize(s){return String(s).toLowerCase().replace(/[^a-z0-9+#./-]+/g,' ').replace(/\s+/g,' ').trim()}
function keywords(s){return normalize(s).split(' ').filter(x=>x.length>2&&!STOP.has(x))}
function textSet(xs){const out=new Set();for(const x of xs)for(const k of keywords(x))out.add(k);return out}
function matches(signal,haystack,tokens){const n=normalize(signal);if(!n)return false;if(haystack.includes(n))return true;const ks=keywords(n);if(!ks.length)return false;let hit=0;for(const k of ks)if(tokens.has(k))hit++;if(ks.length===1)return hit===1;if(ks.length===2)return hit===2;return hit>=Math.ceil(ks.length*0.67)}
function observation(input={}){if(input&&typeof input!=='object')throw Error('OBSERVATION_NOT_OBJECT');const out={schema:'axm.code.build-observation.v1',activeLanguages:arr(input.activeLanguages,'activeLanguages').map(normalize),pressures:arr(input.pressures,'pressures').map(normalize)};for(const f of FIELDS)out[f]=arr(input[f],f);const body={...out};return freeze({...out,observationSha256:hash(canon(body))})}
function discoverySignals(e){const nativeVocabulary=new Set([...e.perspective.seesFirst,...e.perspective.semanticHazards].map(normalize));return e.perspective.opportunitySignals.filter(s=>!nativeVocabulary.has(normalize(s)))}
function reviewEye(e,o){const active=new Set(o.activeLanguages);const nativePresent=active.has(normalize(e.languageId));const context=[...FIELDS.flatMap(f=>o[f])];const riskContext=[...o.risks,...o.gaps,...o.constraints,...o.notes];const hay=normalize(context.join(' | ')),riskHay=normalize(riskContext.join(' | '));const toks=textSet(context),riskToks=textSet(riskContext);
 const candidateSignals=discoverySignals(e);
 const opportunityMatches=candidateSignals.filter(s=>matches(s,hay,toks));
 const hazardMatches=e.perspective.semanticHazards.filter(s=>matches(s,riskHay,riskToks));
 const verifierMatches=e.perspective.verifierInstincts.filter(s=>matches(s,riskHay,riskToks));
 const exactOpportunity=candidateSignals.some(s=>{const n=normalize(s);return n.length>4&&hay.includes(n)});
 let state='NOT_RELEVANT';
 if(nativePresent)state='NATIVE_REVIEW';
 else if(exactOpportunity||opportunityMatches.length>=2)state='DISCOVERY_CANDIDATE';
 else if(opportunityMatches.length===1||hazardMatches.length>0)state='WEAK_SIGNAL';
 const gaps=[];
 if(state==='DISCOVERY_CANDIDATE')gaps.push('CROSS_LANGUAGE_OPPORTUNITY');
 if(nativePresent&&hazardMatches.length)gaps.push('SEMANTIC_HAZARD_EXPOSURE');
 if(nativePresent&&o.gaps.length&&verifierMatches.length===0)gaps.push('VERIFICATION_GAP_CANDIDATE');
 if((nativePresent||state==='DISCOVERY_CANDIDATE')&&o.gaps.length)gaps.push('NATIVE_GRAMMAR_GAP_CANDIDATE');
 const declaredPressureReasons=[];for(const p of o.pressures){const r=e.discoverySeam.declaredPressureReasons[p];if(r)declaredPressureReasons.push(r)}
 const route=nativePresent?'REUSE_AND_REVIEW':state==='DISCOVERY_CANDIDATE'?'DISCOVER_AND_COMPARE':state==='WEAK_SIGNAL'?'HOLD_FOR_MORE_EVIDENCE':'NOT_RELEVANT';
 const strength=nativePresent?'NATIVE':(exactOpportunity||opportunityMatches.length>=3)?'STRONG':opportunityMatches.length>=2?'MODERATE':opportunityMatches.length===1||hazardMatches.length?'WEAK':'NONE';
 const result={schema:'axm.code-native-eye-review/v1',eyeId:e.eyeId,eyeDigest:e.eyeSha256,languageId:e.languageId,displayName:e.displayName,state,strength,route,nativePresent,matched:{opportunities:opportunityMatches,hazards:hazardMatches,verifiers:verifierMatches},gapCandidates:[...new Set(gaps)],declaredPressureReasons:[...new Set(declaredPressureReasons)],humanDeveloperQuestions:e.humanDeveloperLens.nativeQuestions,discovery:{candidateIsDecision:false,reasonInferenceWithoutCallerEvidence:'FORBIDDEN',suggestedNextCheck:state==='DISCOVERY_CANDIDATE'?`Compare the current approach with a bounded ${e.displayName} prototype against the matched signals; use ${e.perspective.verifierInstincts[0]||'a native verifier'} before accepting the idea.`:nativePresent?`Review the active ${e.displayName} body around its native hazards and affected dependencies before changing it.`:'No action from this eye without stronger caller-supplied evidence.'},authority:{workspaceRead:false,workspaceMutation:false,toolExecution:false,network:false,install:false,languageSwitch:false,promotion:false,canon:false}};
 return freeze(result)}
function review(input={}){const o=observation(input),results=eyes.all().map(e=>reviewEye(e,o));const ranked=[...results].sort((a,b)=>STATE_WEIGHT[b.state]-STATE_WEIGHT[a.state]||b.matched.opportunities.length-a.matched.opportunities.length||a.languageId.localeCompare(b.languageId));const summary={schema:'axm.code-native-discovery-seam-report/v1',status:'TEST',observationSha256:o.observationSha256,eyeSnapshotSha256:eyes.snapshot().snapshotSha256,eyeCount:results.length,nativeReviewCount:results.filter(x=>x.state==='NATIVE_REVIEW').length,discoveryCandidateCount:results.filter(x=>x.state==='DISCOVERY_CANDIDATE').length,weakSignalCount:results.filter(x=>x.state==='WEAK_SIGNAL').length,notRelevantCount:results.filter(x=>x.state==='NOT_RELEVANT').length,automaticAction:false,reasonInferenceWithoutCallerEvidence:'FORBIDDEN',authority:'NONE'};const body={summary,topCandidates:ranked.filter(x=>x.state!=='NOT_RELEVANT').slice(0,20),eyes:results};return freeze({...body,reportSha256:hash(canon(body))})}
module.exports={observation,review,reviewEye,discoverySignals};
