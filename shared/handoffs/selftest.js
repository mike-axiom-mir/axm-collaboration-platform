'use strict';
const assert=require('assert'),B=require('./artifact-handoff-broker');
const tools=[
  {id:'studio',name:'Studio',produces:['image/png','image/svg+xml'],accepts:['image/*']},
  {id:'film',name:'Film',produces:['video/mp4'],accepts:['image/*','audio/*']},
  {id:'audio',name:'Audio',produces:['audio/wav'],accepts:['audio/*']},
  {id:'project',name:'Project Room',produces:['axm.project/v1'],accepts:['axm.handoff/v1']},
  {id:'legacy-film',name:'Legacy Film',integratedInto:'film',destinationId:'film',destinationName:'Film',accepts:['image/png'],produces:['video/mp4']}
];
assert.equal(B.match('image/png','image/*'),'wildcard');assert.equal(B.match('image/png','image/png'),'exact');assert.equal(B.match('image/png','audio/*'),null);
const destinations=B.compatible(tools,'studio','image/png');assert.ok(destinations.some(x=>x.destinationId==='film'));assert.ok(!destinations.some(x=>x.destinationId==='project'));
assert.throws(()=>B.compatible(tools,'studio','video/mp4'),/does not declare/);
const p=B.proposal(tools,{sourceId:'studio',artifactKind:'image/png',destinationId:'film',artifactId:'poster-1'});assert.equal(B.validate(p).ok,true);assert.equal(p.state,'REVIEW_REQUIRED');assert.equal(p.truth.artifactDataCopied,false);assert.equal(p.truth.automaticImport,false);
const handResult={schema:'axm.asset-hand-result/v1',id:'result-1',digest:'digest-1',hand:{schema:'axm.asset-hand/v2',id:'vector-form',version:'1.1.0'},brief:{fallback_policy:{generalist:'forbidden',lossy_conversion:'forbidden'},target_canvas_validation:{pass:true,errors:[],transformations:[]}},target_canvas:{schema:'axm.target-canvas/v1',medium:'screen'},target_canvas_original:{schema:'axm.target-canvas/v1',medium:'screen'},canvas_transform_receipt:{status:'UNCHANGED'},creation_recipe:{schema:'axm.asset-creation-recipe/v1'},validation_receipt:{schema:'axm.asset-validation-receipt/v1',status:'PASS'},artifacts:[{id:'svg',role:'source',mime:'image/svg+xml',format:'SVG',digest:'a1',editable:true,metadata:{}}]};
const referenceValidation={schema:'axm.asset-verification-envelope/v1',result_id:'result-1',result_digest:'digest-1',status:'CORROBORATED',receipts:[]};
const hp=B.proposal(tools,{sourceId:'studio',artifactKind:'image/png',destinationId:'film',artifactId:'poster-1',assetHandResult:handResult});assert.equal(B.VERSION,'0.2.0');assert.equal(B.validate(hp).ok,true);assert.equal(hp.truth.canvasAndRecipeMetadataCopied,true);assert.equal(hp.assetHand.targetCanvasOriginal.medium,'screen');assert.equal(hp.assetHand.targetCanvasValidation.pass,true);assert.equal(hp.assetHand.creationRecipe.schema,'axm.asset-creation-recipe/v1');
assert.throws(()=>B.assetHandProvenance(Object.assign({},handResult,{validation_receipt:{status:'HOLD'}})),/validated/);
assert.equal(B.assetHandProvenance(Object.assign({},handResult,{reference_validation:referenceValidation})).referenceValidation.result_digest,'digest-1');
assert.throws(()=>B.assetHandProvenance(Object.assign({},handResult,{reference_validation:Object.assign({},referenceValidation,{result_digest:'wrong'})})),/not bound/);
assert.throws(()=>B.proposal(tools,{sourceId:'studio',artifactKind:'image/png',destinationId:'project'}),/compatible/);
console.log('AXM Artifact Handoff Broker selftest: PASS (declared formats, exact/wildcard matching, explicit proposal and zero copied data)');
