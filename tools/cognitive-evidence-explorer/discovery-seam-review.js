#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..','..'),m=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'))),c=JSON.parse(fs.readFileSync(path.join(__dirname,'module.contract.json'))),hub=fs.readFileSync(path.join(root,'hub','hub-shell.js'),'utf8'),api=fs.readFileSync(path.join(root,'shared','operations','operations-api.js'),'utf8');
assert.strictEqual(m.id,'cognitive-evidence-explorer');assert.strictEqual(m.integratedInto,'cognitive-resource-meter');assert.strictEqual(m.layer,'machine');assert.deepStrictEqual(m.permissions,[]);assert.deepStrictEqual(c.boundaries.writes,[]);assert(hub.includes("'cognitive-evidence-explorer'"));assert(api.includes("'/api/cognitive-resource-meter/timeline'"));assert(api.includes("'/api/cognitive-evidence-labs'"));
console.log('Cognitive Evidence Explorer discovery seam: PASS');
