#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..','..'),m=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'))),c=JSON.parse(fs.readFileSync(path.join(__dirname,'module.contract.json'))),hub=fs.readFileSync(path.join(root,'hub','hub-shell.js'),'utf8'),api=fs.readFileSync(path.join(root,'shared','operations','operations-api.js'),'utf8');
assert.strictEqual(m.integratedInto,'cognitive-resource-meter');assert.strictEqual(m.layer,'machine');assert.deepStrictEqual(m.permissions,c.permissions);assert(hub.includes("'sustainability-metrology-lab'"));assert(api.includes("'/api/cognitive-evidence-labs/sustainability'"));assert(api.includes("requirePermission('sustainability-metrology-lab','sustainability.evidence.write')"));assert(c.boundaries.refuses.includes('token-to-energy-conversion'));
console.log('Sustainability Metrology Lab discovery seam: PASS');
