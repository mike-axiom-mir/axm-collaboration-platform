#!/usr/bin/env node
'use strict';
const fs=require('fs');
const files=['tools/agent-command-center/index.html','tools/agent-tool-forge/index.html','tools/launcher-card-installer/index.html','tools/evidence-desk/index.html','tools/model-lab/index.html','tools/duo-test/index.html','tools/game-hub/index.html','tools/sandbox/projects/robo-pong/index.html','tools/studio/index.html'];
let pass=0;
for(const file of files){
  const html=fs.readFileSync(file,'utf8');let count=0;
  for(const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
    new Function(m[1]);count++;
  }
  if(!count)throw new Error(file+' has no inline script to check');
  console.log('PASS '+file+' · '+count+' inline script(s) compile');pass++;
}
console.log('\n'+pass+' PASS · 0 FAIL');
