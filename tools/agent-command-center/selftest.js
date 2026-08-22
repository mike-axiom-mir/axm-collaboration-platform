#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Registry = require('./identity-registry.js');

const readJson = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const manifest = readJson('manifest.json');
const contract = readJson('module.contract.json');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const memory = {};
const storage = {
  getItem: key => Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null,
  setItem: (key, value) => { memory[key] = String(value); },
  removeItem: key => { delete memory[key]; }
};

Registry.configure({ storage }).reset();
assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.contract, 'module.contract.json');
assert.equal(contract.schema, 'axm.module-contract/v1');
assert.equal(contract.id, manifest.id);
assert.equal(contract.version, manifest.version);
assert.deepEqual(contract.permissions, manifest.permissions);
assert.equal(Registry.profiles().length, 5);
assert.equal(Registry.connectorFor('keel'), 'codex-workspace');
assert.equal(Registry.binding('keel').askEnabled, false);
assert.equal(Registry.profile('keel').corePath, 'prompts/local/keel-core.txt');
assert.equal(Registry.connectorFor('nova'), 'local');
assert.equal(Registry.binding('nova').model, 'axm-llama-3.1-8b');
assert.equal(Registry.connectorFor('axiom-mir'), 'chatgpt');
assert.equal(Registry.binding('mirror').askEnabled, false);
assert.equal(Registry.defaultIdentity(), null);
assert.equal(Registry.memories('keel', { includeShared:false }).some(item => item.id === 'keel-working-name-and-boundary'), true);

const privateEntry = Registry.remember('nova', {
  text: 'Bounded private fixture', source: 'selftest', evidence: ['direct fixture'], confidence: 'high'
});
assert.equal(privateEntry.scope, 'private');
assert.equal(Registry.memories('axiom-mir', { includeShared:false }).some(item => item.text === privateEntry.text), false);
assert.equal(Registry.memories('keel', { includeShared:false }).some(item => item.text === privateEntry.text), false);
const sharedEntry = Registry.remember('nova', {
  text: 'Explicit shared fixture', source: 'selftest', evidence: ['explicit shared option'], confidence: 'high'
}, { shared:true });
assert.equal(sharedEntry.scope, 'shared');
assert.equal(Registry.memories('axiom-mir').some(item => item.text === sharedEntry.text), true);
assert.throws(() => Registry.assertRoute('nova', 'chatgpt'), /blocked/);
assert.throws(() => Registry.ask('mirror', 'fixture'), /wisdom-only/);
assert.throws(() => Registry.ask('keel', 'fixture'), /external Codex workspace/);
assert.match(Registry.context('keel'), /TECHNICAL SUBSTRATE: Codex is the technical model\/runtime description/);
assert(html.includes('Sharing requires the explicit checkbox.'));
assert(html.includes("$('shareWisdom').checked"));
assert(contract.boundaries.refuses.includes('cross-identity-private-memory-merge'));
assert(contract.boundaries.refuses.includes('automatic-wisdom-promotion'));
console.log('PASS Agent Command Center contract · five bound identities including Keel · private/shared memory separation · no hidden routing authority');
