(function(root,factory){
  const isNode=typeof module!=='undefined'&&module.exports;
  const api=factory(
    isNode?require('./core.js'):root.AXMDeterministicOrganFabric,
    isNode?require('./selected-creative-production-route-organ.contract.json'):null,
    isNode?require('./field-packs/creative-production.json'):null
  );
  if(isNode)module.exports=api;
  if(typeof window!=='undefined')root.AXMSelectedCreativeProductionRouteOrgan=api;
})(typeof self!=='undefined'?self:this,function(Fabric,defaultContract,defaultPack){
  'use strict';

  if(!Fabric||typeof Fabric.generateCandidates!=='function'||typeof Fabric.runDefinition!=='function')throw new Error('AXM Deterministic Organ Fabric core is required.');

  function refusal(code,message,details){const error=new Error(message);error.code=code;if(details!==undefined)error.details=details;return error;}
  function omit(value,key){const copy=Fabric.clone(value);delete copy[key];return copy;}
  function options(value){value=value||{};return {contract:value.contract||defaultContract,pack:value.pack||defaultPack};}
  function assertAuthority(authority){const required=['generatedCodeExecuted','assetGenerated','validatorsExecuted','humanReviewPerformed','wroteState','installed','registered','staged','promoted','canonChanged','foundationChanged'];return authority&&required.every(function(key){return authority[key]===false;})&&Object.keys(authority).every(function(key){return required.indexOf(key)>=0;});}

  function resolveSelectedCandidate(value){
    const resolved=options(value),contract=resolved.contract,pack=resolved.pack;
    if(!contract||contract.schema!=='axm.trusted-creative-production-route-organ/v1'||contract.id!=='selected-fabric-review-production-route'||contract.version!=='0.1.0'||contract.status!=='EXPERIMENTAL'||contract.strategy!=='balanced')throw refusal('SELECTED_CREATIVE_ORGAN_CONTRACT_INVALID','The trusted Creative Production admission contract is unavailable or invalid.');
    if(!assertAuthority(contract.authority))throw refusal('SELECTED_CREATIVE_ORGAN_AUTHORITY_INVALID','The Creative Production admission contract exceeds its authority ceiling.');
    if(!pack||pack.id!=='creative-production'||pack.version!==contract.intent.fieldPackRef.version||pack.packDigest!==contract.intent.fieldPackRef.digest)throw refusal('SELECTED_CREATIVE_ORGAN_PACK_STALE','The selected organ does not bind the current Creative Production pack.');
    if(contract.intent.intentDigest!==contract.selection.intentDigest)throw refusal('SELECTED_CREATIVE_ORGAN_INTENT_DRIFT','The admitted intent digest differs from the selection lineage.');
    const intentCheck=Fabric.validateIntent(contract.intent,pack);
    if(!intentCheck.ok)throw refusal('SELECTED_CREATIVE_ORGAN_INTENT_INVALID','The admitted intent fails current validation.',intentCheck.errors);
    const run=Fabric.generateCandidates(contract.intent,pack);
    if(run.status!=='COMPLETE'||run.runDigest!==contract.selection.runDigest)throw refusal('SELECTED_CREATIVE_ORGAN_RUN_DRIFT','The selected generation run no longer rebuilds identically.',{expected:contract.selection.runDigest,actual:run.runDigest});
    const comparison=Fabric.compareCandidates(run);
    if(comparison.comparisonDigest!==contract.selection.comparisonDigest)throw refusal('SELECTED_CREATIVE_ORGAN_COMPARISON_DRIFT','The selected comparison no longer rebuilds identically.',{expected:contract.selection.comparisonDigest,actual:comparison.comparisonDigest});
    const candidate=run.candidates.find(function(row){return row.definition.strategy===contract.strategy;});
    if(!candidate||candidate.package.packageDigest!==contract.selection.packageDigest||!Fabric.verifyPackage(candidate).ok)throw refusal('SELECTED_CREATIVE_ORGAN_PACKAGE_DRIFT','The selected balanced package no longer rebuilds and verifies identically.');
    const rebuiltSelection=Fabric.selectCandidate(comparison,candidate,contract.selection.selectedBy);
    if(rebuiltSelection.selectionDigest!==contract.selection.selectionDigest)throw refusal('SELECTED_CREATIVE_ORGAN_SELECTION_DRIFT','The Creative Production selection receipt no longer rebuilds identically.');
    return {contract:contract,pack:pack,run:run,comparison:comparison,candidate:candidate,selectionReceipt:rebuiltSelection};
  }

  function normalizeBrief(brief){
    if(!brief||typeof brief!=='object'||Array.isArray(brief))throw refusal('CREATIVE_BRIEF_INVALID','The Creative Production brief must be an object.');
    const allowed=['medium','delivery','accessibility'],unknown=Object.keys(brief).filter(function(key){return allowed.indexOf(key)<0;});
    if(unknown.length)throw refusal('CREATIVE_BRIEF_UNKNOWN_FIELD','The Creative Production brief contains unknown fields.',unknown);
    if(typeof brief.medium!=='string'||typeof brief.delivery!=='string'||!Array.isArray(brief.accessibility)||brief.accessibility.some(function(item){return typeof item!=='string'||!item.trim();}))throw refusal('CREATIVE_BRIEF_TYPE_INVALID','The Creative Production brief requires medium, delivery, and a string accessibility list.');
    if(brief.accessibility.length>256)throw refusal('CREATIVE_BRIEF_RESOURCE_LIMIT','The accessibility list exceeds the 256-item ceiling.');
    const normalized={medium:brief.medium,delivery:brief.delivery,accessibility:Array.from(new Set(brief.accessibility.map(function(item){return item.trim();}))).sort()};
    if(new TextEncoder().encode(Fabric.canonicalJson(normalized)).length>32768)throw refusal('CREATIVE_BRIEF_RESOURCE_LIMIT','The Creative Production brief exceeds the 32 KiB input ceiling.');
    return normalized;
  }

  function plan(brief,value){
    const selected=resolveSelectedCandidate(value),input=normalizeBrief(brief),run=Fabric.runDefinition(selected.candidate.definition,input);
    if(!run.ok)throw refusal(run.refusal&&run.refusal.code||'CREATIVE_ROUTE_REFUSED',run.refusal&&run.refusal.message||'The selected Creative Production organ refused this brief.',run.refusal&&run.refusal.details);
    const result={
      schema:'axm.trusted-creative-production-route-output/v1',
      status:'EXPERIMENTAL',
      implementation:{id:selected.contract.id,version:selected.contract.version,strategy:selected.contract.strategy,packageDigest:selected.candidate.package.packageDigest,selectionDigest:selected.selectionReceipt.selectionDigest},
      input:input,
      productionPlan:Fabric.clone(run.output),
      openHumanJudgments:Fabric.clone(selected.pack.humanJudgments),
      authority:{trustedRuntimeEvaluated:true,generatedCodeExecuted:false,assetGenerated:false,validatorsExecuted:false,humanReviewPerformed:false,wroteState:false,installed:false,registered:false,staged:false,promoted:false,canonChanged:false,foundationChanged:false},
      outputDigest:''
    };
    result.outputDigest=Fabric.digest(omit(result,'outputDigest'));
    return result;
  }

  function verify(output,brief,value){
    const errors=[];
    try{const rebuilt=plan(brief||output&&output.input,value);if(Fabric.canonicalJson(rebuilt)!==Fabric.canonicalJson(output))errors.push({code:'SELECTED_CREATIVE_ORGAN_OUTPUT_REBUILD_MISMATCH',message:'Trusted Creative Production output does not rebuild identically.'});}
    catch(error){errors.push({code:error.code||'SELECTED_CREATIVE_ORGAN_VERIFY_REFUSED',message:String(error.message||error),details:error.details});}
    return {ok:errors.length===0,errors:errors,outputDigest:output&&output.outputDigest||null};
  }

  function inspect(value){const selected=resolveSelectedCandidate(value);return {schema:'axm.trusted-creative-production-route-organ-inspection/v1',status:'EXPERIMENTAL',id:selected.contract.id,version:selected.contract.version,strategy:selected.contract.strategy,intentDigest:selected.contract.selection.intentDigest,runDigest:selected.run.runDigest,comparisonDigest:selected.comparison.comparisonDigest,packageDigest:selected.candidate.package.packageDigest,selectionDigest:selected.selectionReceipt.selectionDigest,packageVerified:true,generatedCodeExecuted:false,authority:Fabric.clone(selected.contract.authority)};}

  return {plan:plan,verify:verify,inspect:inspect,resolveSelectedCandidate:resolveSelectedCandidate,normalizeBrief:normalizeBrief};
});
