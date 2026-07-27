'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Engine = require('../../shared/experiment-world/experiment-world');

const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const contract = JSON.parse(read('module.contract.json'));
const html = read('index.html');
const app = read('app.js');

assert.equal(ContractVerifier.validateContract(contract, manifest).pass, true, 'module contract must validate');
assert.equal(manifest.status, 'EXPERIMENTAL');
assert.equal(manifest.audience, 'human-machine');
assert.equal(manifest.permissions.length, 0);
assert.match(manifest.notes, /not live-connected/i);
assert.ok(contract.boundaries.refuses.includes('fake-live-mirror-claim'));
assert.ok(contract.boundaries.refuses.includes('canonical-workshop-write'));
assert.ok(contract.boundaries.refuses.includes('arbitrary-code-execution-v0'));
assert.ok(contract.boundaries.refuses.includes('external-network-access'));

['index.html', 'styles.css', 'app.js', 'README.md'].forEach(file => assert.ok(fs.existsSync(path.join(__dirname, file)), file + ' must exist'));
assert.match(html, /Creative freedom inside\. Zero silent authority outside\./);
assert.match(html, /MIRROR CONTRACT READY \/ NOT CONNECTED/);
assert.match(html, /NO AUTHORITY BEYOND THIS SURFACE/);
assert.match(html, /Nothing saves automatically/);
assert.match(html, /Open machine intent port/);
assert.match(html, /Freeze candidate for review/);
assert.match(html, /DECLARED INTENT BUDGET/);
assert.match(html, /request ceiling · not telemetry/);
assert.match(html, /Declared compute/);
assert.doesNotMatch(html, /Promote candidate|Install candidate|Run arbitrary code/);
assert.ok(app.includes('Engine.observe'));
assert.ok(app.includes('Engine.applyIntent'));
assert.ok(app.includes('Engine.checkpoint'));
assert.ok(app.includes('localStorage.removeItem(STORAGE_KEY)'));
assert.ok(!/\bfetch\s*\(/.test(app), 'tool must not call the network');
assert.ok(!/XMLHttpRequest|WebSocket|EventSource/.test(app), 'tool must not open transport');

const proof = Engine.create({ goal: 'proof', mode: 'curiosity', createdAt: '2026-07-23T00:00:00.000Z' });
const frame = Engine.observe(proof, { id: 'selftest', kind: 'machine' });
assert.equal(frame.truth.canonicalWorkshopChanged, false);
assert.equal(frame.truth.mirrorConnected, false);
assert.equal(frame.truth.observerCanMutateWorld, false);
assert.equal(frame.truth.resourceUsageMeasured, false);
assert.ok(Engine.ALLOWED_EFFECTS.includes('candidate-memory'));

console.log('mirror-holo-shoebox selftest: PASS - transparent observer, explicit persistence, typed machine port, declared resource envelope, allowlisted effects, no live-Mirror/code-execution/canon claim');
