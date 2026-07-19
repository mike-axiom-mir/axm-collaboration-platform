#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {verifyGameDir}=require('../../../game-package-verifier');
const root=path.join(__dirname,'..');
const failures=[];
const packageResult=verifyGameDir(root);failures.push(...packageResult.errors);
const assets=require('../assets/ASSET_MANIFEST.json');
if(assets.externalAssets.length)failures.push('external assets are not allowed in this package');
for(const asset of assets.runtimeAssets)if(!fs.existsSync(path.join(root,asset.path)))failures.push('asset manifest path missing: '+asset.path);
const pkg=require('../package.json');if(Object.keys(pkg.dependencies||{}).length)failures.push('runtime dependencies must remain empty unless separately reviewed');
const remote=[];
for(const directory of ['client','server','shared']){
  const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(?:js|css|html)$/.test(entry.name)){const text=fs.readFileSync(file,'utf8');for(const match of text.matchAll(/https?:\/\/[^'"\s)]+/g))if(!/^http:\/\/(?:127\.0\.0\.1|localhost)/.test(match[0]))remote.push(path.relative(root,file)+': '+match[0])}}};walk(path.join(root,directory));
}
if(remote.length)failures.push(...remote.map(value=>'remote runtime literal: '+value));
console.log('CIRCUITSEED PACKAGE VERIFY');
console.log((failures.length?'FAIL':'PASS')+' · slot 009 · '+packageResult.game);
failures.forEach(value=>console.log('  - '+value));
console.log('procedural assets='+assets.runtimeAssets.length+' · external assets='+assets.externalAssets.length);
if(failures.length)process.exitCode=1;
