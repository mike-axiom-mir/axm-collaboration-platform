#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const files=['tools/agent-command-center/index.html','tools/agent-tool-forge/index.html','tools/ai-team/index.html','tools/publish-library/index.html','tools/game-forge/index.html','tools/game-forge/preview.html','tools/knowledge-canvas/index.html','tools/finance-world-room/index.html','tools/audio-studio/index.html','tools/audio-studio/sound-lab-engine.html','tools/film-motion-studio/index.html','tools/launcher-card-installer/index.html','tools/evidence-desk/index.html','tools/model-lab/index.html','tools/duo-test/index.html','tools/game-hub/index.html','tools/game-hub/game-library/006-lumenwake/runtime/lumenwake-client.html','tools/chatgpt-connector/index.html','tools/project-room/index.html','tools/prompt-vault/index.html','tools/ui-ux-builder/index.html','tools/sandbox/projects/robo-pong/index.html','tools/studio/index.html'];
let pass=0;
for(const file of files){
  const html=fs.readFileSync(file,'utf8');let count=0;
  for(const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
    new Function(m[1]);count++;
  }
  if(file==='tools/project-room/index.html'||file==='tools/chatgpt-connector/index.html'||file==='tools/ui-ux-builder/index.html'||file==='tools/ai-team/index.html'||file==='tools/publish-library/index.html'||file==='tools/game-forge/index.html'||file==='tools/knowledge-canvas/index.html'||file==='tools/finance-world-room/index.html'||file==='tools/audio-studio/index.html'||file==='tools/film-motion-studio/index.html'){
    for(const m of html.matchAll(/<script[^>]*\bsrc=["']([^"']+\.js)["'][^>]*><\/script>/gi)){
      if(m[1].startsWith('/'))continue;
      new Function(fs.readFileSync(path.join(path.dirname(file),m[1]),'utf8'));count++;
    }
  }
  if(!count)throw new Error(file+' has no local script to check');
  console.log('PASS '+file+' · '+count+' inline script(s) compile');pass++;
}
console.log('\n'+pass+' PASS · 0 FAIL');
