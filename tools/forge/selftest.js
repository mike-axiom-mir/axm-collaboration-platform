#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
let failures = 0;

function check(label, condition) {
  if (condition) console.log('PASS ' + label);
  else { console.error('FAIL ' + label); failures += 1; }
}

check('manifest identifies the Forge entry point', manifest.id === 'forge' && manifest.entry === 'index.html');
check('manifest declares only the documented powers', Array.isArray(manifest.uses) && manifest.uses.includes('storage') && manifest.uses.includes('export'));
check('generated manifests retain an explicit TEST status', page.includes("status:'TEST'"));
check('generated saves retain a version marker', page.includes('{ format:1, yourData }'));
check('generated shells keep the local AXM foundation boundary', page.includes('<scr' + "'+'ipt src=\"axm-foundation.js\""));
check('generated shells make AI optional and honest', page.includes('if (a.noAI) { work without it'));
check('generated shells retain the meaningful-action gate', page.includes("AXMGate.submit({action:\"'+id+'.thing\""));
check('generated shells retain the 44px accessibility floor', page.includes('min-height:44px'));
check('Forge requires a tool name and plain-language purpose', page.includes("if(!nm) return alert('Name the tool first.')") && page.includes("if(!desc) return alert('Say what it does"));
check('official ids retain an explicit human confirmation', page.includes('OFFICIAL tool id') && page.includes('confirm('));

if (failures) process.exitCode = 1;
else console.log('Tool Forge selftest: PASS - 10 checks');
