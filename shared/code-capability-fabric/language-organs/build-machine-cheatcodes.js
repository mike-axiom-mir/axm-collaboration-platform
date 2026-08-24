'use strict';
const fs=require('fs'),path=require('path');
const fabric=require('./machine-cheatcode-fabric.js');
const ROOT=path.join(__dirname,'organs');
function target(bank){return path.join(ROOT,`${String(require('./registry.js').getByLanguageId(bank.languageId).priority).padStart(3,'0')}-${bank.languageId}`,'machine.cheatcodes.json');}
function render(bank){return JSON.stringify(bank,null,2)+'\n';}
function run(mode){const banks=fabric.all();if(banks.length!==102)throw Error(`MACHINE_CHEATCODE_BANK_COUNT_NOT_102:${banks.length}`);let changed=0;for(const bank of banks){const p=target(bank),want=render(bank),have=fs.existsSync(p)?fs.readFileSync(p,'utf8'):null;if(mode==='--write'){if(have!==want){fs.writeFileSync(p,want,'utf8');changed++;}}else if(mode==='--check'){if(have!==want)throw Error(`MACHINE_CHEATCODE_DRIFT:${bank.languageId}`);}else throw Error('Usage: node build-machine-cheatcodes.js --write|--check');}console.log(JSON.stringify({ok:true,mode,bankCount:banks.length,totalRuleCount:banks.reduce((n,b)=>n+b.ruleCount,0),changed},null,2));}
run(process.argv[2]);
