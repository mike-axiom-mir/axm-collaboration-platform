#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const errors=[];
const files=walk(ROOT).filter(file=>!file.includes(`${path.sep}.git${path.sep}`));
const required=[
  'src/core/action-bus.js','src/core/control-runtime.js','src/core/input-behavior.js','src/core/performance-probe.js',
  'src/adapters/keyboard-mouse-adapter.js','src/adapters/gamepad-adapter.js','src/adapters/network-controller-adapter.js',
  'src/ui/phone-controller.js','server/reference-server.cjs','migrations/robo-pong/legacy-robo-pong-bridge.cjs',
  'demo/host.html','demo/phone.html','docs/09_ACCEPTANCE_STATUS.md','docs/16_SATURDAY_LIVE_TEST_CARD.md',
  'tools/START_SATURDAY_TEST_WINDOWS.cmd','tests/reconnect-live.test.js','tests/reconnecting-websocket.test.js'
];
for(const relative of required) if(!fs.existsSync(path.join(ROOT,relative))) errors.push(`missing required file ${relative}`);
for(const file of files){
  const relative=path.relative(ROOT,file);
  if(relative.startsWith(`node_modules${path.sep}`)) errors.push('node_modules must not be packaged');
  if(file.endsWith('.json')){try{JSON.parse(fs.readFileSync(file,'utf8'))}catch(error){errors.push(`${relative}: invalid JSON: ${error.message}`)}}
  if(file.endsWith('.js')||file.endsWith('.cjs')){
    const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if(result.status!==0) errors.push(`${relative}: syntax check failed: ${(result.stderr||result.stdout).trim()}`);
  }
}
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
if(Object.keys(pkg.dependencies||{}).length) errors.push('runtime dependencies are not allowed in this local reference package');
const report={ok:errors.length===0,checkedAt:new Date().toISOString(),fileCount:files.length,jsonFiles:files.filter(file=>file.endsWith('.json')).length,scriptFiles:files.filter(file=>/\.(c?js)$/.test(file)).length,requiredFiles:required,errors};
fs.mkdirSync(path.join(ROOT,'proof'),{recursive:true});
fs.writeFileSync(path.join(ROOT,'proof','STATIC_VALIDATION_REPORT.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(errors.length) process.exitCode=1;
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const full=path.join(directory,entry.name);return entry.isDirectory()?walk(full):[full]})}
