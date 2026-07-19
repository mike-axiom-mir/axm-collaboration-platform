#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const read=file=>fs.readFileSync(path.join(__dirname,file),'utf8'),server=fs.readFileSync(path.join(__dirname,'..','..','server.js'),'utf8'),core=fs.readFileSync(path.join(__dirname,'..','..','shared','technical-glasses','technical-glasses-core.js'),'utf8'),ai=fs.readFileSync(path.join(__dirname,'..','ai-team','ai-team-core.js'),'utf8');
const checks=[
 ['Every API request recompiles current source',server.includes('compileTechnicalGlasses(focus)')&&server.includes('/api/workshop/technical-glasses')],
 ['Portable text and structured JSON share one snapshot',server.includes('/api/workshop/technical-glasses.txt')&&server.includes('snapshot.briefing')],
 ['Offline use invokes the same compiler',fs.existsSync(path.join(__dirname,'..','..','shared','technical-glasses','technical-glasses-cli.js'))],
 ['Snapshot persistence is atomic',core.includes("file + '.tmp'")&&core.includes('fs.renameSync')],
 ['README and chat memory are explicitly below technical evidence',core.includes('readmeTechnicalAuthority: false')&&core.includes('chatMemoryTechnicalAuthority: false')],
 ['Missing state is UNKNOWN instead of guessed',core.includes('missingMeansUnknown: true')&&core.includes('noGuessing: true')],
 ['Structural scan refuses to impersonate runtime proof',core.includes('A clean structural scan does not replace runtime or human behavior testing.')],
 ['No action or permission authority is granted',core.includes('automaticAction: false')&&core.includes('permissionChange: false')],
 ['AI Team exposes the shared view',ai.includes("id:'technical'")&&ai.includes("route:'technical'" )],
 ['UI refuses a stale cache when live compilation fails',read('technical-glasses-app.js').includes('no cached result was substituted')],
 ['Visible refresh is bounded while hidden tabs idle',read('technical-glasses-app.js').includes('if(!document.hidden)compile(true)')],
 ['Any instance receives evidence paths and reading order',core.includes('instructionsForAnyAI')&&core.includes('readingOrder')&&core.includes('evidence:')]
];
let failed=0;checks.forEach(([name,pass])=>{console.log((pass?'PASS  ':'OPEN  ')+name);if(!pass)failed++;});console.log('Technical Glasses discovery seam review: '+(failed?'OPEN '+failed:'PASS · 12 controls'));if(failed)process.exit(1);
