#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const Core=require('../tools/agent-tool-forge/forge-core.js');
const Zip=require('../tools/agent-tool-forge/zip-store.js');
const foundation=fs.readFileSync(path.join(__dirname,'../tools/agent-tool-forge/axm-foundation.js'),'utf8');
const draft={id:'mike.package-proof',name:'Package Proof',kind:'dual-door-tool',risk:'MEDIUM',purpose:'Prove the Forge emits a complete reviewable ZIP.',primary_output:'An experimental dual-door module',capabilities:['storage','gate','export'],tags:['factory-proof'],boundaries:['No installation','No Foundation edits','No promotion']};
const p=Core.buildPackage(draft,{foundationSource:foundation});
if(!p.ok)throw new Error(p.errors.join('; '));
const out='/tmp/mike.package-proof-EXPERIMENTAL.zip';
fs.writeFileSync(out,Zip.build(p.files,p.draft.id));
console.log(JSON.stringify({ok:true,path:out,files:Object.keys(p.files).sort(),packageFingerprint:p.packageFingerprint,installed:p.install.performed},null,2));
