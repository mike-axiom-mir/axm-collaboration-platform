(function(root,factory){
  const isNode=typeof module!=='undefined'&&module.exports;
  const api=factory(
    isNode?require('./core.js'):root.AXMDeterministicOrganFabric,
    isNode?require('./selected-verification-route-organ.contract.json'):null,
    isNode?require('./field-packs/software-workshop.json'):null
  );
  if(isNode)module.exports=api;
  if(typeof window!=='undefined')root.AXMSelectedVerificationRouteOrgan=api;
})(typeof self!=='undefined'?self:this,function(Fabric,defaultContract,defaultPack){
  'use strict';

  if(!Fabric||typeof Fabric.generateCandidates!=='function'||typeof Fabric.planVerificationRouteForPack!=='function')throw new Error('AXM Deterministic Organ Fabric core is required.');

  function refusal(code,message,details){const error=new Error(message);error.code=code;if(details!==undefined)error.details=details;return error;}
  function omit(value,key){const copy=Fabric.clone(value);delete copy[key];return copy;}
  function options(value){value=value||{};return {contract:value.contract||defaultContract,pack:value.pack||defaultPack};}
  function assertAuthority(authority){const required=['generatedCodeExecuted','wroteState','installed','registered','staged','promoted','canonChanged','foundationChanged'];return authority&&required.every(function(key){return authority[key]===false;})&&Object.keys(authority).every(function(key){return required.indexOf(key)>=0;});}

  function resolveSelectedCandidate(value){
    const resolved=options(value),contract=resolved.contract,pack=resolved.pack;
    if(!contract||contract.schema!=='axm.trusted-verification-route-organ/v1'||contract.id!=='selected-workshop-verification-route'||contract.version!=='0.1.0'||contract.status!=='EXPERIMENTAL'||contract.strategy!=='balanced')throw refusal('SELECTED_ORGAN_CONTRACT_INVALID','The trusted selected-organ admission contract is unavailable or invalid.');
    if(!assertAuthority(contract.authority))throw refusal('SELECTED_ORGAN_AUTHORITY_INVALID','The selected-organ admission contract exceeds its authority ceiling.');
    if(!pack||pack.id!=='software-workshop'||pack.version!==contract.intent.fieldPackRef.version||pack.packDigest!==contract.intent.fieldPackRef.digest)throw refusal('SELECTED_ORGAN_PACK_STALE','The selected organ does not bind the current Software & Workshop pack.');
    if(contract.intent.intentDigest!==contract.selection.intentDigest)throw refusal('SELECTED_ORGAN_INTENT_DRIFT','The admitted intent digest differs from the selection lineage.');
    const intentCheck=Fabric.validateIntent(contract.intent,pack);
    if(!intentCheck.ok)throw refusal('SELECTED_ORGAN_INTENT_INVALID','The admitted intent fails current validation.',intentCheck.errors);
    const run=Fabric.generateCandidates(contract.intent,pack);
    if(run.status!=='COMPLETE'||run.runDigest!==contract.selection.runDigest)throw refusal('SELECTED_ORGAN_RUN_DRIFT','The selected generation run no longer rebuilds identically.',{expected:contract.selection.runDigest,actual:run.runDigest});
    const comparison=Fabric.compareCandidates(run);
    if(comparison.comparisonDigest!==contract.selection.comparisonDigest)throw refusal('SELECTED_ORGAN_COMPARISON_DRIFT','The selected comparison no longer rebuilds identically.',{expected:contract.selection.comparisonDigest,actual:comparison.comparisonDigest});
    const candidate=run.candidates.find(function(row){return row.definition.strategy===contract.strategy;});
    if(!candidate||candidate.package.packageDigest!==contract.selection.packageDigest||!Fabric.verifyPackage(candidate).ok)throw refusal('SELECTED_ORGAN_PACKAGE_DRIFT','The selected balanced package no longer rebuilds and verifies identically.');
    const rebuiltSelection=Fabric.selectCandidate(comparison,candidate,contract.selection.selectedBy);
    if(rebuiltSelection.selectionDigest!==contract.selection.selectionDigest)throw refusal('SELECTED_ORGAN_SELECTION_DRIFT','The implementation selection receipt no longer rebuilds identically.');
    return {contract:contract,pack:pack,run:run,comparison:comparison,candidate:candidate,selectionReceipt:rebuiltSelection};
  }

  function spineRisk(value){return Number(value)>=4?'high':Number(value)>=3?'medium':'low';}
  function plan(brief,value){
    const selected=resolveSelectedCandidate(value),routePlan=Fabric.planVerificationRouteForPack(selected.candidate,brief,selected.pack),evidenceDesk=Fabric.clone(routePlan.evidenceDeskPrefill);
    evidenceDesk.actor={id:'selected-workshop-verification-route',type:'trusted-deterministic-organ'};
    const claims=[],unmapped=[];
    routePlan.bindings.forEach(function(binding){
      if(!binding.verificationSpine){unmapped.push(binding.token);return;}
      claims.push({token:binding.token,categoryId:binding.verificationSpine.categoryId,claimId:binding.verificationSpine.claimId,status:'UNKNOWN',required:true,risk:spineRisk(routePlan.input.brief.risk),summary:binding.description,evidenceRoute:{kind:binding.evidenceDesk.claimKind,surface:binding.evidenceDesk.primarySurface,passCondition:binding.evidenceDesk.passCondition}});
    });
    const result={
      schema:'axm.trusted-verification-route-output/v1',
      status:'EXPERIMENTAL',
      implementation:{id:selected.contract.id,version:selected.contract.version,strategy:selected.contract.strategy,packageDigest:selected.candidate.package.packageDigest,selectionDigest:selected.selectionReceipt.selectionDigest},
      plan:routePlan,
      evidenceDeskPrefill:evidenceDesk,
      verificationSpinePrefill:{schema:'axm.verification-spine-prefill/v1',targetProfile:'workshop-full',subject:{id:selected.candidate.package.id,kind:'verification-route-plan',digest:routePlan.planDigest},claims:claims,unmappedTokens:unmapped,limitations:['UNKNOWN is preserved until each native verifier emits evidence.','Tokens without an exact Verification Spine mapping remain explicit in unmappedTokens and are never guessed.']},
      authority:{trustedRuntimeEvaluated:true,generatedCodeExecuted:false,checksExecuted:false,browserOperated:false,wroteState:false,installed:false,registered:false,staged:false,promoted:false,canonChanged:false,foundationChanged:false},
      outputDigest:''
    };
    result.outputDigest=Fabric.digest(omit(result,'outputDigest'));return result;
  }

  function verify(output,brief,value){
    const errors=[];try{const rebuilt=plan(brief||(output&&output.plan&&output.plan.input&&output.plan.input.brief),value);if(Fabric.canonicalJson(rebuilt)!==Fabric.canonicalJson(output))errors.push({code:'SELECTED_ORGAN_OUTPUT_REBUILD_MISMATCH',message:'Trusted selected-organ output does not rebuild identically.'});}catch(error){errors.push({code:error.code||'SELECTED_ORGAN_VERIFY_REFUSED',message:String(error.message||error),details:error.details});}
    return {ok:errors.length===0,errors:errors,outputDigest:output&&output.outputDigest||null};
  }

  function inspect(value){const selected=resolveSelectedCandidate(value);return {schema:'axm.trusted-verification-route-organ-inspection/v1',status:'EXPERIMENTAL',id:selected.contract.id,version:selected.contract.version,strategy:selected.contract.strategy,intentDigest:selected.contract.selection.intentDigest,runDigest:selected.run.runDigest,comparisonDigest:selected.comparison.comparisonDigest,packageDigest:selected.candidate.package.packageDigest,selectionDigest:selected.selectionReceipt.selectionDigest,packageVerified:true,generatedCodeExecuted:false,authority:Fabric.clone(selected.contract.authority)};}

  return {plan:plan,verify:verify,inspect:inspect,resolveSelectedCandidate:resolveSelectedCandidate};
});
