'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const Planner=require('../../../../../shared/code-capability-fabric/deterministic-game-trailer-planner-v1');
const Video=require('../../../../../shared/asset-hands/video-codec');
const Raster=require('../../../../../shared/asset-hands/raster-codec');
const Builder=require('./build-trailer');

async function main(){
  const first=await Builder.render(),second=await Builder.render();
  assert.strictEqual(first.planned.request.requestDigest,second.planned.request.requestDigest);
  assert.strictEqual(first.planned.plan.planDigest,second.planned.plan.planDigest);
  for(const name of Object.keys(first.files))assert.strictEqual(Builder.sha(first.files[name]),Builder.sha(second.files[name]),name+' is not deterministic');
  assert.strictEqual(first.built.uniqueFrames.length,48);assert.strictEqual(first.built.sequence.length,360);assert.strictEqual(first.built.uniqueFrames.reduce((sum,item)=>sum+item.byteLength,0),44236800);
  assert.strictEqual(first.encoded.durationSeconds,30);assert.deepStrictEqual(first.encoded.frameRate,{numerator:12,denominator:1});
  assert.strictEqual(Video.inspectMp4(first.files[Builder.FILES.mp4]).pass,true);assert.strictEqual(Video.inspectWebm(first.files[Builder.FILES.webm]).pass,true);
  for(const name of [Builder.FILES.first,Builder.FILES.middle,Builder.FILES.last]){const inspection=Raster.inspectPng(first.files[name]);assert.strictEqual(inspection.pass,true);assert.strictEqual(inspection.width,640);assert.strictEqual(inspection.height,360);}
  assert.match(first.files[Builder.FILES.vtt].toString('utf8'),/^WEBVTT\n\n1\n00:00:00\.000 --> 00:00:05\.000/);assert.strictEqual((first.files[Builder.FILES.vtt].toString('utf8').match(/ --> /g)||[]).length,6);
  const diskReceipt=JSON.parse(fs.readFileSync(path.join(Builder.OUTPUT,Builder.FILES.receipt),'utf8'));assert.deepStrictEqual(diskReceipt,first.receipt);assert.strictEqual(diskReceipt.truth.published,false);assert.strictEqual(diskReceipt.rights.publicDistribution,'HOLD');assert.strictEqual(diskReceipt.authority,'NONE');
  for(const [name,bytes] of Object.entries(first.files)){const disk=fs.readFileSync(path.join(Builder.OUTPUT,name));assert.strictEqual(Builder.sha(disk),Builder.sha(bytes),name+' disk drift');}
  const outputPaths=first.planned.plan.outputPaths.slice().sort(),actualPaths=Object.keys(first.files).map((name)=>'media/rendered/'+name).sort();assert.deepStrictEqual(actualPaths,outputPaths);
  const stale=JSON.parse(first.files[Builder.FILES.plan]);stale.plan.truth.published=true;assert.strictEqual(Planner.verify(stale,first.planned.request).pass,false);
  console.log('PASS Four Roots deterministic trailer render (MP4 + WebM, 48 unique/360 samples, exact 30s, captions, decode, budgets, determinism, rights HOLD)');
}
main().catch((error)=>{console.error(error.stack||error);process.exit(1);});
