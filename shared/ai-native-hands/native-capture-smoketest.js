#!/usr/bin/env node
'use strict';

const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const Native=require('./windows-native-capture-hand');

if(!process.argv.includes('--live')){console.error('Refusing native screen capture without --live.');process.exit(2);}
const root=fs.mkdtempSync(path.join(os.tmpdir(),'axm-native-eye-'));
try{
  const proposal=Native.proposeLease({createdBy:'mike-live-proof',recipients:['codex-proof'],scope:'screen.primary',durationMinutes:2,maxCaptures:1,minIntervalMs:1000,purpose:'one explicit local Eye smoke test'}),lease=Native.activateLease(proposal,'ALLOW NATIVE EYE'),hand=Native.create({stateRoot:path.join(root,'state')}),provider=hand.captureFrame({lease:lease,recipient:'codex-proof',maxWidth:960,quality:68});
  provider().then(function(frame){assert.ok(/^data:image\/jpeg;base64,/.test(frame.dataUrl));assert.equal(frame.nativeReceipt.cleanupComplete,true);const jpgs=fs.existsSync(hand.tempRoot)?fs.readdirSync(hand.tempRoot).filter(name=>name.endsWith('.jpg')):[];assert.deepEqual(jpgs,[]);const result={pass:true,capability:Native.CAPABILITY,bytes:frame.nativeReceipt.bytes,sha256:frame.nativeReceipt.sha256,cleanupComplete:true,temporaryJpegsRemaining:0,rawVideoArchive:false};if(process.argv.includes('--emit-data-url'))result.dataUrl=frame.dataUrl;console.log(JSON.stringify(result,null,2));}).catch(function(error){console.error(error.stack||error);process.exitCode=1;}).finally(function(){fs.rmSync(root,{recursive:true,force:true});});
}catch(error){fs.rmSync(root,{recursive:true,force:true});throw error;}
