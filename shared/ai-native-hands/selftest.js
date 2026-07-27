#!/usr/bin/env node
'use strict';

const assert=require('assert');
const crypto=require('crypto');
const fs=require('fs');
const os=require('os');
const path=require('path');
const Hands=require('./index');

const fixtureHtml=fs.readFileSync(path.join(__dirname,'computed-style-fixture.html'),'utf8');

let checks=0;
function check(value,message){assert.ok(value,message);checks++;console.log('PASS '+message);}

(async function(){
  const route=Hands.evidenceRouter.route({id:'phone-layout',claim:'Phone controls fit the portrait viewport',kind:'visual',risk:'high',passCondition:'No controls are clipped'});
  check(route.primarySurface==='live-rendered-frame-at-declared-state'&&route.requiredSurfaces.length===2,'Evidence Router chooses visual proof plus a high-risk countercheck');
  check(route.automaticVerdict===false&&route.verdict==='UNTESTED','Evidence Router cannot promote its own plan into proof');

  const gap=Hands.capabilityGap.compare([{id:'eye-live',capabilities:['visual.capture.ephemeral-rolling-buffer/v1','vision.observe.sequence/v1'],required:true,gapType:'HAND'}],[{id:'vision.observe.sequence/v1',status:'available'}]);
  check(gap.overall==='BLOCKED'&&gap.missingCapabilities[0]==='visual.capture.ephemeral-rolling-buffer/v1','Capability Gap names the exact missing rolling-buffer hand');
  check(gap.automaticInstall===false&&gap.proposedContracts[0].requiredFields.includes('verification'),'Capability Gap emits a contract without installing or granting anything');

  const nativeProposal=Hands.windowsNativeCapture.proposeLease({createdBy:'selftest-human',recipients:['mirror','codex'],scope:'screen.primary',durationMinutes:15,maxCaptures:12});
  check(nativeProposal.state==='PROPOSED'&&nativeProposal.automaticActivation===false,'Windows Native Eye starts as an inactive permission proposal');
  assert.throws(function(){Hands.windowsNativeCapture.validateLease(nativeProposal,'mirror');},/active human-approved/);checks++;console.log('PASS Windows Native Eye refuses an unapproved capture lease');
  const nativeLease=Hands.windowsNativeCapture.activateLease(nativeProposal,'ALLOW NATIVE EYE');
  check(Hands.windowsNativeCapture.validateLease(nativeLease,'mirror').target==='primary'&&nativeLease.recipients.includes('codex'),'Windows Native Eye activates only through exact human confirmation and names its recipients');
  assert.throws(function(){Hands.windowsNativeCapture.validateLease(nativeLease,'unknown-agent');},/outside/);checks++;console.log('PASS Windows Native Eye refuses recipients outside the lease');

  let frame=0;const fakeFrame=async()=>({dataUrl:'data:image/jpeg;base64,'+Buffer.alloc(1200,++frame).toString('base64'),capturedAt:'2026-07-19T00:00:0'+frame+'.000Z'}),eye=Hands.ephemeralVision.create({captureFrame:fakeFrame,maxFrames:3,maxBytes:10000});
  await eye.captureNow();await eye.captureNow();await eye.captureNow();await eye.captureNow();
  check(eye.status().frames===3&&eye.status().evicted===1,'Eye rolling buffer evicts the oldest frame inside its bound');
  const seal=await eye.seal({typedObservation:{kind:'motion',summary:'three ordered frames retained for judgment'}});
  check(/^[a-f0-9]{64}$/.test(seal.bufferDigest)&&seal.rawVideoArchive===false,'Eye seals a tiny digest receipt without a raw-video archive');
  const memoryCleanup=eye.cleanup(seal);
  check(memoryCleanup.cleanupComplete&&eye.status().frames===0&&memoryCleanup.temporaryFramesDeleted===3,'Eye wipes every buffered frame after sealing');

  const Computed=Hands.computedStyle;
  check(Computed.opaqueHex(Computed.parseCssColor('rgb(255, 255, 255)'))==='#ffffff'&&Computed.opaqueHex(Computed.parseCssColor('#000'))==='#000000','Computed Style normalizes browser colours deterministically');
  function fakeElement(tagName,id,attributes,style,box){
    attributes=attributes||{};
    return{tagName:tagName,id:id||'',parentElement:null,_style:style||{},_box:box||{width:100,height:24},_children:[],getAttribute:function(name){return Object.prototype.hasOwnProperty.call(attributes,name)?attributes[name]:null;},getBoundingClientRect:function(){return this._box;},querySelectorAll:function(selector){return selector==='*'?this._children.slice():[];}};
  }
  const fixture=fakeElement('MAIN','visual-fixture',{}, {display:'block',visibility:'visible',opacity:'1',backgroundColor:'rgb(0, 0, 0)',backgroundImage:'none',color:'rgb(255, 255, 255)',fontSize:'16px',fontWeight:'400'},{width:640,height:480});
  const copy=fakeElement('P','body-copy',{'data-axm-critical-text':'true'}, {display:'block',visibility:'visible',opacity:'1',backgroundColor:'transparent',backgroundImage:'none',color:'rgb(255, 255, 255)',fontSize:'16px',fontWeight:'400'},{width:300,height:24});
  const button=fakeElement('BUTTON','save-button',{}, {display:'block',visibility:'visible',opacity:'1',backgroundColor:'rgb(32, 32, 32)',backgroundImage:'none',color:'rgb(255, 255, 255)',fontSize:'16px',fontWeight:'700'},{width:96,height:48});
  const signal=fakeElement('DIV','completion-signal',{'data-axm-uses-sound':'true','data-axm-visible-equivalent':'true'}, {display:'block',visibility:'visible',opacity:'1',backgroundColor:'transparent',backgroundImage:'none',color:'rgb(255, 255, 255)',fontSize:'16px',fontWeight:'400'},{width:100,height:24});
  copy.parentElement=fixture;button.parentElement=fixture;signal.parentElement=fixture;fixture._children=[copy,button,signal];
  const fakeDocument={getElementById:function(id){return id==='visual-fixture'?fixture:null;},querySelectorAll:function(){return[];}};
  const styleHand=Computed.create({document:fakeDocument,getComputedStyle:function(element){return element._style;},maxElements:12});
  const measured=styleHand.read({targetId:'visual-fixture',observedAt:'2026-07-24T12:00:00.000Z'});
  check(measured.schema===Computed.RESULT_SCHEMA&&measured.coverage.complete&&measured.contentInspected===false&&measured.mutatedSurface===false,'Computed Style reads one exact bounded DOM root without content inspection or mutation');
  check(measured.measuredProperties.contrastPairs.length===2&&measured.measuredProperties.interactiveTargets[0].heightPx===48&&measured.measuredProperties.criticalText.length===1&&measured.measuredProperties.signals[0].visibleEquivalent===true,'Computed Style emits Eye 4 contrast, target, critical-text and signal measurements');
  assert.throws(function(){styleHand.read({targetId:'missing-target'});},/exact visual target/);checks++;console.log('PASS Computed Style refuses an unavailable exact target');
  check(fixtureHtml.includes('data-axm-target-id="flat-visual-fixture"')&&fixtureHtml.includes('data-axm-target-id="gradient-visual-fixture"')&&fixtureHtml.includes('AXMComputedStyleHand.create')&&fixtureHtml.includes('aria-live="polite"'),'Computed Style live fixture exposes bounded flat and honest gradient journeys');

  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'axm-ai-native-hands-')),stateRoot=path.join(temp,'state'),ownedRoot=path.join(temp,'eye-temp');fs.mkdirSync(ownedRoot,{recursive:true});const chunk=path.join(ownedRoot,'chunk-1.webm'),bytes=Buffer.from('ephemeral-only');fs.writeFileSync(chunk,bytes);const digest=crypto.createHash('sha256').update(bytes).digest('hex'),curator=Hands.sessionCurator.create({stateRoot});const manifest={schema:Hands.sessionCurator.MANIFEST_SCHEMA,owner:Hands.sessionCurator.EYE_OWNER,bufferId:'eye-buffer-one',ownedRoot:ownedRoot,files:[{relativePath:'chunk-1.webm',sha256:digest}]};
  const preview=curator.cleanupEphemeral(manifest,{apply:false,record:false});
  check(preview.mode==='PREVIEW'&&fs.existsSync(chunk),'Curator previews exact cleanup without deleting');
  const applied=curator.cleanupEphemeral(manifest,{apply:true,authority:'eye-current-loop'});
  check(applied.cleanupComplete&&!fs.existsSync(chunk)&&applied.deleted[0].sha256===digest,'Curator deletes only a digest-matched Eye-owned temporary file');
  const sealed=curator.seal('ai-native-hands-selftest');
  check(sealed.sealed&&sealed.manifest.summary.SESSION_EXACT===1,'Curator records and seals the cleanup receipt through Evidence Retention');
  fs.rmSync(temp,{recursive:true,force:true});

  console.log('\nAI-native hands selftest: PASS ('+checks+' checks)');
})().catch(function(error){console.error(error.stack||error);process.exitCode=1;});
