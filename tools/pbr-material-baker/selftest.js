#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root=__dirname;let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks+=1;};
const equal=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks+=1;};
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const json=name=>JSON.parse(read(name));
const hash=value=>crypto.createHash('sha256').update(Buffer.from(value.buffer,value.byteOffset,value.byteLength)).digest('hex').toUpperCase();

async function main(){
  const manifest=json('manifest.json'),contract=json('module.contract.json');
  equal(manifest.id,'pbr-material-baker','Manifest identity');equal(contract.id,manifest.id,'Contract identity');equal(contract.version,manifest.version,'Contract version');equal(manifest.category,'Create','Hub parent');
  check(manifest.actions.length===4&&manifest.produces.length===3,'Machine metadata populated');check(contract.boundaries.automaticWrites.length===0,'No automatic writes');
  for(const refusal of ['automatic-library-promotion','automatic-candidate-retention','visual-quality-approval-by-statistics','flat-map-labelled-as-baked-signal','undeclared-normal-map-convention','ps3-quality-claim-from-map-presence'])check(contract.boundaries.refuses.includes(refusal),`Boundary refuses ${refusal}`);
  const sources=['index.html','styles.css','app.js','pbr-baker-core.mjs','pbr-baker-verifier.mjs'].map(read).join('\n');check(!/https?:\/\//i.test(sources),'No external runtime URL');check(!/from\s+['\"].*pbr-baker-core/.test(read('pbr-baker-verifier.mjs')),'Verifier is independent from baker implementation');check(/Human material gate remains open/.test(read('index.html'))&&/MEMORY-ONLY PREVIEW/.test(read('index.html')),'Human and retention boundaries are visible');
  const core=await import(pathToFileURL(path.join(root,'pbr-baker-core.mjs')).href),verifier=await import(pathToFileURL(path.join(root,'pbr-baker-verifier.mjs')).href);
  equal(Object.keys(core.MATERIAL_FAMILIES),['brick','asphalt','painted-metal','glass','skin','vehicle-paint'],'Six first-build families exist');
  const familyHashes=new Set();
  for(const family of Object.keys(core.MATERIAL_FAMILIES)){
    const recipe={family,seed:`proof-${family}`,size:64},first=core.bakeMaterial(recipe),second=core.bakeMaterial(recipe),verification=verifier.verifyMaterialBake(first);
    equal(first.recipe.size,64,`${family} exact requested size`);equal(first.recipe.tangentConvention,core.TANGENT_CONVENTION,`${family} tangent convention`);equal(verification.status,'pass',`${family} technical gate passes`);equal(verification.summary.passed,12,`${family} complete check set`);
    for(const name of ['albedo','normal','orm','emissive','height']){equal(first.maps[name].length,64*64*4,`${family} ${name} dimensions`);equal(hash(first.maps[name]),hash(second.maps[name]),`${family} ${name} deterministic`);}
    check(first.maps.albedo.every((value,index)=>index%4!==3||value===255),`${family} albedo alpha is explicit opaque`);check(!Buffer.from(first.maps.albedo).equals(Buffer.from(first.maps.normal)),`${family} albedo and normal are distinct`);
    const ball=core.renderMaterialBall(first);equal(ball.length,64*64*4,`${family} reference render dimensions`);check(new Set(ball).size>16,`${family} reference render has visible signal`);familyHashes.add(hash(first.maps.albedo));
  }
  equal(familyHashes.size,6,'All material families have distinct albedo identities');
  equal(core.bakeMaterial({family:'brick',size:2}).recipe.size,32,'Minimum bake size bounded');equal(core.bakeMaterial({family:'brick',size:9999}).recipe.size,512,'Maximum bake size bounded');
  const negative=core.bakeMaterial({family:'brick',size:32});negative.maps.height.fill(128);for(let offset=0;offset<negative.maps.normal.length;offset+=4){negative.maps.normal[offset]=128;negative.maps.normal[offset+1]=128;negative.maps.normal[offset+2]=255;negative.maps.normal[offset+3]=255;}
  const failed=verifier.verifyMaterialBake(negative);equal(failed.status,'fail','Flat height and normal fail closed');check(failed.checks.some(item=>item.id==='height-signal'&&item.status==='fail'),'Flat height named');check(failed.checks.some(item=>item.id==='normal-signal'&&item.status==='fail'),'Flat normal named');
  const start=Date.now();core.bakeMaterial({family:'vehicle-paint',size:256});check(Date.now()-start<3000,'256-square bake remains bounded under three seconds');
  console.log(`PBR Material Baker self-test passed ${checks} checks.`);
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
