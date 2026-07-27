'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Engine = require('../../shared/game-organism/game-organism');
const Examples = require('../../shared/game-organism/examples');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
assert.equal(ContractVerifier.validateContract(contract, manifest).pass, true, 'module contract must validate');
assert.equal(manifest.status, 'EXPERIMENTAL');
assert.equal(manifest.permissions.length, 0);
assert.ok(contract.boundaries.refuses.includes('canonical-game-write'));
assert.ok(contract.boundaries.refuses.includes('automatic-promotion'));

['index.html', 'styles.css', 'app.js'].forEach(file => assert.ok(fs.existsSync(path.join(root, file)), file + ' must exist'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /CANDIDATE ONLY/);
assert.match(html, /Sever physics seam/);
assert.match(html, /Download receipt/);
assert.doesNotMatch(html, /Start organs|Install candidate|Promote automatically/);

const example = Examples.createStreetLifeExample();
const receipt = Engine.compile(example.blueprint, example.registry);
assert.equal(receipt.verdict, 'CANDIDATE_READY');
assert.equal(receipt.truth.executionStarted, false);
assert.equal(receipt.truth.canonicalGameChanged, false);
assert.equal(receipt.truth.humanReleaseRequired, true);

console.log('game-organism-lab selftest: PASS · candidate plan only · human release preserved');
