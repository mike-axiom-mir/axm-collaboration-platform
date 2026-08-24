'use strict';
const fs=require('fs'),path=require('path');
const fabric=require('./machine-template-fabric.js');
const ROOT=path.join(__dirname,'organs');
function canonJson(v){return JSON.stringify(v,null,2)+'\n'}
function organDir(languageId){const dirs=fs.readdirSync(ROOT,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name);const hit=dirs.find(d=>d.endsWith(`-${languageId}`));if(!hit)throw Error(`ORGAN_DIR_MISSING:${languageId}`);return path.join(ROOT,hit)}
function run(mode){let changed=0;const banks=fabric.all();if(banks.length!==102)throw Error(`BANK_COUNT_NOT_102:${banks.length}`);for(const bank of banks){const p=path.join(organDir(bank.languageId),'machine.templates.json');const expected=canonJson(bank);const observed=fs.existsSync(p)?fs.readFileSync(p,'utf8'):null;if(observed!==expected){if(mode==='--write'){fs.writeFileSync(p,expected,'utf8');changed++}else throw Error(`MACHINE_TEMPLATE_DRIFT:${bank.languageId}`)}}const snap=fabric.snapshot();console.log(JSON.stringify({ok:true,mode,bankCount:banks.length,verifiedTemplateCount:snap.verifiedTemplateCount,skeletonCount:snap.skeletonCount,changed,snapshotSha256:snap.snapshotSha256},null,2))}
const mode=process.argv[2]||'--check';if(!['--write','--check'].includes(mode))throw Error('MODE_MUST_BE_WRITE_OR_CHECK');run(mode);
