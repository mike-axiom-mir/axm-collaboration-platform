#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const contract = JSON.parse(read('module.contract.json'));
const html = read('index.html');

assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.kind, 'product');
assert.equal(manifest.contract, 'module.contract.json');
assert.equal(contract.id, manifest.id);
assert.equal(contract.version, manifest.version);
assert.deepEqual(contract.permissions, manifest.permissions);
assert(html.includes('No task is dispatched merely by adding it.'));
assert(html.includes('Queue empty. No prompts will be invented.'));
assert(html.includes("if(!online){addLog('Dispatcher refused"));
assert(html.includes("runDispatched>=cap"));
assert(html.includes("talkRemaining<=0"));
assert(html.includes("taskBusy||talkBusy"));
assert(html.includes("$('resumeDispatch').checked=false"));
assert(html.includes("$('resumeTalk').checked=false"));
assert(contract.boundaries.refuses.includes('cloud-fallback'));
assert(contract.boundaries.refuses.includes('unbounded-loop'));
assert(contract.boundaries.refuses.includes('automatic-wisdom-promotion'));
console.log('PASS AI Task & Talk contract · visible prompts · explicit opt-in · bounded local-model dispatch · no automatic wisdom');
