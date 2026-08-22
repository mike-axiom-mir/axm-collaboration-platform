#!/usr/bin/env node
'use strict';
const crypto=require('crypto'),fs=require('fs'),path=require('path');
const Core=require('../tools/agent-tool-forge/forge-core.js');
const Zip=require('../tools/agent-tool-forge/zip-store.js');
const foundation=fs.readFileSync(path.join(__dirname,'../tools/agent-tool-forge/axm-foundation.js'),'utf8');
const draft={id:'mike.package-proof',name:'Package Proof',kind:'dual-door-tool',risk:'MEDIUM',purpose:'Prove the Forge emits a complete reviewable ZIP.',primary_output:'An experimental dual-door module',capabilities:['storage','gate','export'],tags:['factory-proof'],boundaries:['No installation','No Foundation edits','No promotion']};
const p=Core.buildPackage(draft,{foundationSource:foundation});
if(!p.ok)throw new Error(p.errors.join('; '));
const archive=Buffer.from(Zip.build(p.files,p.draft.id));
const workshopRoot=path.resolve(__dirname,'..');
const scratchRoot=path.join(workshopRoot,'state','test-scratch','agent-tool-forge');
fs.mkdirSync(scratchRoot,{recursive:true});
const runRoot=fs.mkdtempSync(path.join(scratchRoot,'package-proof-'));
const out=path.join(runRoot,'mike.package-proof-EXPERIMENTAL.zip');
let writeVerified=false;
try{
  fs.writeFileSync(out,archive);
  writeVerified=fs.readFileSync(out).equals(archive);
  if(!writeVerified)throw new Error('stored package bytes differ from the built archive');
}finally{
  fs.rmSync(runRoot,{recursive:true,force:true});
}
if(fs.existsSync(runRoot))throw new Error('transient package proof was not cleaned');
console.log(JSON.stringify({
  ok:true,
  route:'workspace-local-transient',
  workspaceRootDrive:path.parse(workshopRoot).root,
  transientPath:path.relative(workshopRoot,out).replace(/\\/g,'/'),
  storageState:'CLEANED',
  writeVerified,
  archiveBytes:archive.length,
  archiveSha256:crypto.createHash('sha256').update(archive).digest('hex'),
  files:Object.keys(p.files).sort(),
  packageFingerprint:p.packageFingerprint,
  installed:p.install.performed
},null,2));
