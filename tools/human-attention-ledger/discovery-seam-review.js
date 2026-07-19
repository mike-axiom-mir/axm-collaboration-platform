#!/usr/bin/env node
'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..','..'),m=JSON.parse(fs.readFileSync(path.join(__dirname,'manifest.json'))),c=JSON.parse(fs.readFileSync(path.join(__dirname,'module.contract.json'))),hub=fs.readFileSync(path.join(root,'hub','hub-shell.js'),'utf8'),api=fs.readFileSync(path.join(root,'shared','operations','operations-api.js'),'utf8');
assert.strictEqual(m.integratedInto,'cognitive-resource-meter');assert.strictEqual(m.layer,'machine');assert.deepStrictEqual(m.permissions,c.permissions);assert(hub.includes("'human-attention-ledger'"));assert(api.includes("'/api/cognitive-evidence-labs/attention'"));assert(api.includes("'/api/cognitive-evidence-labs/attention/withdraw'"));assert(api.includes("requirePermission('human-attention-ledger','human.attention.write')"));assert(c.boundaries.refuses.includes('non-consensual-capture'));
console.log('Human Attention Ledger discovery seam: PASS');
