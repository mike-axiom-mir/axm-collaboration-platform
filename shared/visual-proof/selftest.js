#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Proof=require('./visual-proof');
const Hands=require('../asset-hands/asset-hands');
const Neural=require('../neural-visual/neural-visual-core');
const Raster=require('../asset-hands/raster-codec');

(async function(){
  ['service.contract.json','visual-proof-receipt.schema.json'].forEach(function(name){JSON.parse(fs.readFileSync(path.join(__dirname,name),'utf8'));});
  const observedAt='2026-07-24T12:00:00.000Z',sealedAt='2026-07-24T12:00:01.000Z';
  const assetResult=Hands.create('raster-texture',{id:'proof-raster',title:'Proof raster',kind:'texture',intended_use:'icon',target_canvas:{medium:'screen',dimensions:{width:4,height:4,unit:'px'},colour:{space:'srgb',transparency:'opaque'},behaviour:['static'],performance:{max_texture_memory_bytes:1024},intended_use:'icon'},required_outputs:['image/png'],editable_recipe_formats:['axm.native-raster-recipe/v1']},{seed:'visual-proof',createdAt:observedAt,host:{capabilities:[],permissions:[],network:false}});
  const assetArtifact=assetResult.artifacts.find(function(row){return row.mime==='image/png';});
  const validationDigest=await Proof.evidenceDigest(assetResult.validation_receipt.schema,assetResult.validation_receipt);
  const integrityInput={claimId:'asset-integrity',claimKind:'artifact-integrity',claim:'The generated raster matches its bounded technical contract.',targetId:'proof-raster',artifact:{id:assetArtifact.id,mediaType:assetArtifact.mime,width:assetArtifact.width,height:assetArtifact.height,digest:{algorithm:'axm-asset-digest-v1',value:assetArtifact.digest}},technicalEvidence:[{schema:validationDigest.schema,digest:validationDigest.digest,verdict:'PASS',label:'Asset Hands validation'}],observedAt:observedAt,sealedAt:sealedAt};
  const integrityA=await Proof.seal(integrityInput),integrityB=await Proof.seal(integrityInput);
  assert.equal(integrityA.verdict,'PASS');
  assert.equal(integrityA.visualVerdict,'UNKNOWN');
  assert.equal(integrityA.receiptId,integrityB.receiptId);
  assert.equal((await Proof.verify(integrityA)).pass,true);

  const png=Raster.encodeRgba(1,1,new Uint8Array([40,160,220,255]),{colourSpace:'srgb'}),request=Neural.normalizeRequest({operation:'refine',prompt:'Preserve the exact blue candidate',strength:.2,seed:'proof',target_canvas:{width:1,height:1}}),requestDigest=await Neural.requestSha256(request),sha=await Neural.sha256(png.dataUrl);
  const neuralResult={schema:Neural.RESULT_SCHEMA,version:'1.0.0',status:'PROPOSED',request_digest:requestDigest,provider:{id:'proof-provider',model:'proof-model',receipt_id:'provider-receipt'},artifact:{id:'neural-candidate',mime:'image/png',width:1,height:1,sha256:sha,data_url:png.dataUrl},claims:['candidate only'],ai_dependent:true,authority:'candidate-only',visual_approval:false,canonical:false};
  const neuralChecked=await Neural.verifyResult(neuralResult,request);assert.equal(neuralChecked.pass,true);
  const neuralDigest=await Proof.evidenceDigest(Neural.RESULT_SCHEMA,{request_digest:neuralResult.request_digest,provider:neuralResult.provider,artifact:{id:neuralResult.artifact.id,mime:neuralResult.artifact.mime,width:1,height:1,sha256:sha},claims:neuralResult.claims});
  const appearanceBase={claimId:'neural-appearance',claimKind:'appearance',claim:'The candidate visibly preserves the intended blue appearance.',targetId:'neural-candidate',artifact:{id:'neural-candidate',mediaType:'image/png',width:1,height:1,digest:{algorithm:'sha256',value:sha}},technicalEvidence:[{schema:neuralDigest.schema,digest:neuralDigest.digest,verdict:'PASS',label:'Neural result request and artifact binding'}],observedAt:observedAt,sealedAt:sealedAt};
  const unobserved=await Proof.seal(appearanceBase);
  assert.equal(unobserved.verdict,'UNKNOWN');
  assert.ok(unobserved.namedSeams.includes('MISSING_NATIVE_VISUAL_EVIDENCE'));
  const observed=await Proof.seal(Object.assign({},appearanceBase,{visualEvidence:{backend:'BROWSER_PRIMARY',observedAt:observedAt,viewport:{width:390,height:844},device:'phone',verdict:'PASS',typedObservation:'The bounded rendered candidate is visibly blue and fully inside the viewport.',namedSeams:[],proofRefs:[{ref:'proof/neural-candidate-phone.png',digest:{algorithm:'sha256',value:'1'.repeat(64)}}],frameCount:1,cleanupComplete:true}}));
  assert.equal(observed.verdict,'PASS');
  assert.equal(observed.visualApproval,false);
  assert.equal(observed.canonical,false);

  const thinMotion=await Proof.seal(Object.assign({},appearanceBase,{claimId:'thin-motion',claimKind:'motion',claim:'The transition moves smoothly.',visualEvidence:{backend:'BROWSER_PRIMARY',observedAt:observedAt,viewport:{width:1280,height:720},device:'desktop',verdict:'PASS',typedObservation:'Only start and end were observed.',namedSeams:[],proofRefs:['proof/start.png','proof/end.png'],frameCount:2,cleanupComplete:true}}));
  assert.equal(thinMotion.verdict,'UNKNOWN');
  assert.ok(thinMotion.namedSeams.includes('MOTION_CADENCE_UNPROVEN'));
  assert.ok(thinMotion.namedSeams.includes('UNBOUND_VISUAL_PROOF_REF'));

  await assert.rejects(function(){return Proof.seal(Object.assign({},appearanceBase,{artifact:Object.assign({},appearanceBase.artifact,{dataUrl:'data:image/png;base64,AAAA'})}));},/raw visual material/);
  await assert.rejects(function(){return Proof.seal(Object.assign({},appearanceBase,{frames:['raw-frame-material']}));},/raw visual material/);
  await assert.rejects(function(){return Proof.seal(Object.assign({},appearanceBase,{visualApproval:true}));},/cannot grant approval/);
  const tampered=JSON.parse(JSON.stringify(observed));tampered.claim='Different claim';assert.equal((await Proof.verify(tampered)).pass,false);
  const forged=JSON.parse(JSON.stringify(observed));forged.visualEvidence.proofRefs=[];forged.receiptId='visual-proof-'+(await Proof.sha256((function(){const copy=JSON.parse(JSON.stringify(forged));delete copy.receiptId;return copy;})())).slice(0,24);const forgedCheck=await Proof.verify(forged);assert.equal(forgedCheck.pass,false);assert.ok(forgedCheck.errors.includes('derived verdict mismatch'));
  console.log('AXM Visual Proof selftest: PASS - Asset Hands and Neural Visual binding, native evidence ceiling, motion cadence, deterministic seal, tamper and raw-material refusal');
})().catch(function(error){console.error(error.stack||error);process.exitCode=1;});
