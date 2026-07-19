'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root=path.join(__dirname,'..');
function files(directory,extension,out=[]){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const full=path.join(directory,entry.name);if(entry.isDirectory()&&!['local-data','node_modules'].includes(entry.name))files(full,extension,out);else if(entry.isFile()&&entry.name.endsWith(extension))out.push(full)}return out}

test('all first-party JavaScript parses and all JSON loads', () => {
  const js=files(root,'.js');const json=files(root,'.json');
  for(const file of js){const result=childProcess.spawnSync(process.execPath,['--check',file],{encoding:'utf8'});assert.equal(result.status,0,path.relative(root,file)+'\n'+result.stderr)}
  for(const file of json)assert.doesNotThrow(()=>JSON.parse(fs.readFileSync(file,'utf8')),path.relative(root,file));
  assert.ok(js.length>=18);assert.ok(json.length>=8);
});

test('runtime has no remote URL or CDN dependency literal', () => {
  const runtimeFiles=[...files(path.join(root,'client'),'.js'),...files(path.join(root,'client'),'.css'),...files(path.join(root,'client'),'.html'),...files(path.join(root,'server'),'.js')];
  for(const file of runtimeFiles){
    const text=fs.readFileSync(file,'utf8');
    const urls=Array.from(text.matchAll(/https?:\/\/[^'"\s)]+/g),match=>match[0])
      .filter(url=>!/^http:\/\/(?:127\.0\.0\.1|localhost)/.test(url));
    assert.deepEqual(urls,[],'remote literal in '+path.relative(root,file));
  }
  const pkg=require('../package.json');assert.deepEqual(pkg.dependencies,{});
});

test('procedural asset manifest is complete and declares no external asset', () => {
  const manifest=require('../assets/ASSET_MANIFEST.json');
  assert.deepEqual(manifest.externalAssets,[]);
  for(const item of manifest.runtimeAssets)assert.equal(fs.existsSync(path.join(root,item.path)),true,item.path);
  assert.equal(manifest.policy,'original-procedural-only');
});

test('asset and third-party license policy is explicit and self-consistent', () => {
  const manifest=require('../assets/ASSET_MANIFEST.json');
  const provenance=fs.readFileSync(path.join(root,'ASSET_PROVENANCE.md'),'utf8');
  const thirdParty=fs.readFileSync(path.join(root,'THIRD_PARTY_SOFTWARE.md'),'utf8');
  assert.ok(manifest.runtimeAssets.length>=4);
  for(const item of manifest.runtimeAssets){
    assert.equal(typeof item.creator,'string');
    assert.match(item.license,/Project-local original code/);
    assert.equal(typeof item.method,'string');
  }
  assert.match(provenance,/no downloaded art, audio, icon, texture, font, model, voice, or remote runtime asset/i);
  assert.match(thirdParty,/Runtime third-party packages: \*\*none\*\*/);
});

test('opening, controller and party routes contain required progressive player promise', () => {
  const opening=fs.readFileSync(path.join(root,'client/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'client/app.js'),'utf8');
  for(const phrase of ['NEW JOURNEY','CONTINUE','PROFILES','IMPORT PORTABLE JSON','LOCAL ONLY','SCAN','CONNECT','DEPLOY','ASSIST','RECOVER','RETURN','BUILD / SELL','CIRCUITKIN','30-DESIGN FIELD CODEX','CONFLUENCE EVOLUTION','MEMORY ECHO ARCHIVE','LUMEN YARD SIGNAL BOARD','FIELD MAP','START FRIENDLY 1v1','START FRIENDLY 2v2'])assert.match(opening,new RegExp(phrase.replace('/','\\/'),'i'));
  assert.match(app,/void audio\.unlock\(\)\.then\(\(\) => audio\.startAmbient\(\)\)\.catch\(\(\) => \{\}\)/);
  assert.match(fs.readFileSync(path.join(root,'client/controller/index.html'),'utf8'),/INTENTIONS ONLY/);
  assert.match(fs.readFileSync(path.join(root,'client/party/index.html'),'utf8'),/OCCUPIES NO SEAT/);
});
