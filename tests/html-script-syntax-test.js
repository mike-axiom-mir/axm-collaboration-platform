#!/usr/bin/env node
'use strict';
const fs=require('fs');
const path=require('path');
const operationModules=['recovery-center','module-installer','machine-host','review-inbox','module-contract-workbench','secrets-permissions-console','diagnostics-operations-center','workshop-search-provenance','asset-filesystem-service','device-handoff','browser-lan-hardware-qa-lab','template-runtime-pack-engine','source-connector-hub','media-render-transcode-service','living-world-state-server','multiplayer-controller-transport','living-world-ruleset-physics-adapter-kit','read-only-mirror-world-adapter','novelty-diversity-engine','public-release-deployment-adapter'];
const operationPages=new Set(operationModules.map(id=>'tools/'+id+'/index.html'));
const cognitivePages=new Set(['tools/cognitive-evidence-explorer/index.html','tools/cognitive-calibration-lab/index.html','tools/human-attention-ledger/index.html','tools/sustainability-metrology-lab/index.html','tools/mirror-intake-monitor/index.html']);
cognitivePages.add('tools/workshop-command-center/index.html');
const files=['tools/agent-command-center/index.html','tools/agent-tool-forge/index.html','tools/ai-team/index.html','tools/technical-glasses/index.html','tools/publish-library/index.html','tools/game-forge/index.html','tools/game-forge/preview.html','tools/knowledge-canvas/index.html','tools/finance-world-room/index.html','tools/cognitive-resource-meter/index.html','tools/audio-studio/index.html','tools/audio-studio/sound-lab-engine.html','tools/film-motion-studio/index.html','tools/launcher-card-installer/index.html','tools/evidence-desk/index.html','tools/model-lab/index.html','tools/duo-test/index.html','tools/game-hub/index.html','tools/game-hub/game-library/006-lumenwake/runtime/lumenwake-client.html','tools/chatgpt-connector/index.html','tools/project-room/index.html','tools/prompt-vault/index.html','tools/ui-ux-builder/index.html','tools/sandbox/projects/robo-pong/index.html','tools/studio/index.html','tools/asset-fabric/index.html'].concat(Array.from(cognitivePages),Array.from(operationPages),['shared/asset-hands/index.html']);
let pass=0;
for(const file of files){
  const html=fs.readFileSync(file,'utf8');let count=0;
  for(const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){
    new Function(m[1]);count++;
  }
  if(file==='tools/project-room/index.html'||file==='tools/chatgpt-connector/index.html'||file==='tools/ui-ux-builder/index.html'||file==='tools/ai-team/index.html'||file==='tools/technical-glasses/index.html'||file==='tools/publish-library/index.html'||file==='tools/game-forge/index.html'||file==='tools/knowledge-canvas/index.html'||file==='tools/finance-world-room/index.html'||file==='tools/cognitive-resource-meter/index.html'||file==='tools/audio-studio/index.html'||file==='tools/film-motion-studio/index.html'||file==='tools/game-hub/index.html'||file==='tools/asset-fabric/index.html'||cognitivePages.has(file)||operationPages.has(file)||file==='shared/asset-hands/index.html'){
    for(const m of html.matchAll(/<script[^>]*\bsrc=["']([^"']+\.js)["'][^>]*><\/script>/gi)){
      if(m[1].startsWith('/'))continue;
      new Function(fs.readFileSync(path.join(path.dirname(file),m[1]),'utf8'));count++;
    }
  }
  if(!count)throw new Error(file+' has no local script to check');
  console.log('PASS '+file+' · '+count+' inline script(s) compile');pass++;
}
console.log('\n'+pass+' PASS · 0 FAIL');
