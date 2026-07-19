#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),S=require('./axm-specialist-library'),P=require('../../tools/discovery-engine/review-packs');
const expected=P.listPacks().reduce((n,p)=>n+p.roleCount,0),catalog=S.catalog();assert.equal(catalog.length,expected);
assert.ok(catalog.every(m=>m.source.kind==='discovery-role-pack'&&m.abstentionConditions.length&&m.forbiddenOverreach.length&&m.vetoes.length));
assert.equal(new Set(catalog.map(m=>m.id)).size,catalog.length);assert.ok(catalog.some(m=>m.source.packId==='physics-stance-forge'));
assert.ok(catalog.every(m=>m.runtimeProfile&&m.runtimeProfile.inputs.required.length&&m.runtimeProfile.tools.length&&m.runtimeProfile.artifact.requiredFields.length));
assert.ok(catalog.every(m=>S.compileMask(m.id).files.some(f=>f.path==='CAPABILITY-BRIDGES.json')&&S.compileMask(m.id).files.some(f=>f.path==='OUTPUT.schema.json')));
const server=fs.readFileSync(path.join(__dirname,'..','..','server.js'),'utf8'),hub=fs.readFileSync(path.join(__dirname,'..','..','hub','index.html'),'utf8'),vision=fs.readFileSync(path.join(__dirname,'..','..','hub','ai-vision-loop.js'),'utf8');
assert.ok(server.includes('axm.vision-observation/v1')&&server.includes('targetIdentity')&&server.includes('fs.unlinkSync(VISION_FRAME_FILE)'));
assert.ok(server.includes('recordVisionObservation')&&server.includes('OBSERVATION_ONLY')&&server.includes('trainingData: false')&&server.includes('/api/vision/observations'));
assert.ok(hub.includes('id="visionTarget"')&&hub.includes('Mirror · Seed-0')&&vision.includes('targetIdentity:targetIdentity')&&vision.includes('activeSurfaceConsent:true'));
console.log('Specialist Library seam review: PASS (Discovery contracts reused; every role compiles to bounded methods; Screen Scout routes attributed observations without granting training, wisdom or permission)');
