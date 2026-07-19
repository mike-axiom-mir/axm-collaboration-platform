(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.AXMCreationIncubator=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

var VERSION='0.1.0';
var ARCHIVE_SCHEMA='axm.creation.archive/v1';
var FORM_SCHEMA='axm.creation.form/v1';
var RECEIPT_SCHEMA='axm.creation.characterization/v1';
var DESCRIPTORS=['interaction','structure','tempo','ecology','expression','cooperation'];
var VALUES=['coherence','usefulness','playValue','repairability','resourceCost'];

function clone(v){return JSON.parse(JSON.stringify(v));}
function finite(v){return typeof v==='number'&&Number.isFinite(v);}
function clamp(v,min,max){return Math.max(min,Math.min(max,finite(Number(v))?Number(v):0));}
function hash(value){var s=JSON.stringify(value),out=2166136261;for(var i=0;i<s.length;i++){out^=s.charCodeAt(i);out=Math.imul(out,16777619);}return(out>>>0).toString(16).padStart(8,'0');}
function vector(source,keys){var out={};keys.forEach(function(key){out[key]=clamp(source&&source[key],0,1);});return out;}
function form(input){var source=input&&typeof input==='object'?input:{},nodes=Array.isArray(source.nodes)?source.nodes.map(function(node){return{id:String(node.id||''),kind:String(node.kind||'unknown'),inputs:Array.isArray(node.inputs)?node.inputs.map(String):[],config:clone(node.config||{})};}):[];return{schema:FORM_SCHEMA,id:String(source.id||('form-'+hash(source))),nicheId:String(source.nicheId||'open'),origin:String(source.origin||'unknown'),nodes:nodes,descriptors:vector(source.descriptors,DESCRIPTORS),values:vector(source.values,VALUES),constraints:{valid:source.constraints?source.constraints.valid!==false:true,violations:Array.isArray(source.constraints&&source.constraints.violations)?source.constraints.violations.map(String):[]},representationVersion:String(source.representationVersion||'creation-graph-v1')};}
function distance(a,b){a=form(a);b=form(b);var total=0;DESCRIPTORS.forEach(function(key){var d=a.descriptors[key]-b.descriptors[key];total+=d*d;});return Number(Math.sqrt(total/DESCRIPTORS.length).toFixed(6));}
function novelty(candidate,archive){var entries=archive&&Array.isArray(archive.entries)?archive.entries:[];if(!entries.length)return 1;var nearest=entries.reduce(function(best,row){return Math.min(best,distance(candidate,row.form));},Infinity);return Number(nearest.toFixed(6));}
function dominates(a,b){a=form(a);b=form(b);var noWorse=true,better=false;['coherence','usefulness','playValue','repairability'].forEach(function(key){if(a.values[key]<b.values[key])noWorse=false;if(a.values[key]>b.values[key])better=true;});if(a.values.resourceCost>b.values.resourceCost)noWorse=false;if(a.values.resourceCost<b.values.resourceCost)better=true;return noWorse&&better;}
function newArchive(seed){return{schema:ARCHIVE_SCHEMA,status:'EXPERIMENTAL',archiveId:'creation-'+hash(seed||'seed-0'),representationVersion:'creation-graph-v1',noveltyThreshold:0.12,entries:[],languageExtensions:[],receipts:[]};}
function characterize(archive,input){var candidate=form(input),novel=novelty(candidate,archive),sameNiche=(archive.entries||[]).filter(function(row){return row.form.nicheId===candidate.nicheId;}),dominated=sameNiche.some(function(row){return dominates(row.form,candidate);}),duplicate=(archive.entries||[]).some(function(row){return distance(row.form,candidate)===0&&hash(row.form.nodes)===hash(candidate.nodes);}),valid=candidate.constraints.valid&&!candidate.constraints.violations.length,decision='HOLD',reasons=[];
  if(!valid){reasons.push('Hard constraint failed; form remains outside the archive.');}
  else if(duplicate){reasons.push('Behavior descriptors and structure duplicate an archived form.');}
  else if(novel>=archive.noveltyThreshold){decision='PRESERVE_NOVEL';reasons.push('Safe behavioral novelty earns preservation without needing to defeat one scalar champion.');}
  else if(!dominated){decision='PRESERVE_PARETO';reasons.push('Form contributes a non-dominated value trade-off inside its niche.');}
  else{reasons.push('Form is neither sufficiently novel nor a new non-dominated trade-off.');}
  return{schema:RECEIPT_SCHEMA,status:'EXPERIMENTAL',formId:candidate.id,formDigest:hash(candidate),nicheId:candidate.nicheId,decision:decision,novelty:novel,noveltyThreshold:archive.noveltyThreshold,dominated:dominated,duplicate:duplicate,hardConstraintsPassed:valid,descriptors:clone(candidate.descriptors),values:clone(candidate.values),reasons:reasons,truth:'This receipt characterizes one disposable candidate. Preservation is not canonical promotion, intelligence, usefulness or open-ended evolution.'};
}
function consider(archive,input){var next=clone(archive||newArchive('seed-0')),candidate=form(input),receipt=characterize(next,candidate);next.receipts.push(receipt);if(receipt.decision.indexOf('PRESERVE_')===0)next.entries.push({id:candidate.id,form:candidate,receiptDigest:hash(receipt),preservedFor:receipt.decision==='PRESERVE_NOVEL'?'novelty':'value-trade-off'});return{archive:next,receipt:receipt};}
function proposeLanguageExtension(archive,proposal){var next=clone(archive||newArchive('seed-0')),record={schema:'axm.creation.language-extension-proposal/v1',id:String(proposal&&proposal.id||('extension-'+hash(proposal))),need:String(proposal&&proposal.need||''),newPrimitive:String(proposal&&proposal.newPrimitive||''),examples:Array.isArray(proposal&&proposal.examples)?clone(proposal.examples):[],status:'STRICT_REVIEW_REQUIRED',automaticPromotion:false};next.languageExtensions.push(record);return{archive:next,proposal:record};}

return{VERSION:VERSION,ARCHIVE_SCHEMA:ARCHIVE_SCHEMA,FORM_SCHEMA:FORM_SCHEMA,RECEIPT_SCHEMA:RECEIPT_SCHEMA,DESCRIPTORS:DESCRIPTORS.slice(),VALUES:VALUES.slice(),hash:hash,form:form,distance:distance,novelty:novelty,dominates:dominates,newArchive:newArchive,characterize:characterize,consider:consider,proposeLanguageExtension:proposeLanguageExtension};
});
