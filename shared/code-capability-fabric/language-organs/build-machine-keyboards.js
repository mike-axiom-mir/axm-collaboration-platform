'use strict';
const fs=require('fs'),path=require('path');
const fabric=require('./machine-code-keyboard-fabric.js');
const ROOT=__dirname,ORGAN_ROOT=path.join(ROOT,'organs');
const mode=process.argv.includes('--check')?'CHECK':'WRITE';
let changed=0;const failures=[];const banks=fabric.all();
for(const bank of banks){const dir=fs.readdirSync(ORGAN_ROOT,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).find(name=>name.endsWith(`-${bank.languageId}`));if(!dir){failures.push(`MISSING_ORGAN_DIR:${bank.languageId}`);continue}const p=path.join(ORGAN_ROOT,dir,'machine.keyboard.json');const expected=JSON.stringify(bank,null,2)+'\n';let current=null;try{current=fs.readFileSync(p,'utf8')}catch{}if(current!==expected){changed++;if(mode==='WRITE')fs.writeFileSync(p,expected,'utf8');else failures.push(`KEYBOARD_DRIFT:${bank.languageId}`)}}
const snap=fabric.snapshot();const result={schema:'axm.code.machine-keyboard-build-result.v1',mode,bankCount:banks.length,keysPerBank:snap.keysPerBank,totalStableKeyCount:snap.totalStableKeyCount,changed,snapshotSha256:snap.snapshotSha256,failures,authority:'NONE'};console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;
