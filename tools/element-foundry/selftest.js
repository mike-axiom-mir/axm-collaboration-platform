'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ContractVerifier = require('../../hub/module-contract-verifier');
const Protocol = require('../../shared/elements/element-protocol');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'module.contract.json'), 'utf8'));
assert.equal(ContractVerifier.validateContract(contract, manifest).pass, true, 'module contract must validate');
assert.equal(manifest.status, 'EXPERIMENTAL');
assert.deepEqual(manifest.permissions, []);
assert.ok(contract.boundaries.refuses.includes('automatic-visual-approval'));
assert.ok(contract.boundaries.refuses.includes('silent-element-installation'));

['index.html', 'styles.css', 'app.js'].forEach(file => assert.ok(fs.existsSync(path.join(root, file)), file + ' must exist'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
assert.match(html, /PREVIEW ≠ APPROVAL/);
assert.match(html, /element-protocol\.js/);
assert.ok(html.indexOf('universal-component.js') < html.indexOf('element-protocol.js'), 'UCP must load before the element specialization');
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /:focus-visible/);
assert.match(css, /min-height:\s*44px/);
assert.match(js, /Protocol\.sealComposition/);
assert.match(html, /EXECUTED <b>NO<\/b>/);
assert.match(js, /verifier routes declared/);
assert.doesNotMatch(js, /category verifiers/);
assert.doesNotMatch(js, /automatic[-_ ]?promot/i);

const categories = JSON.parse(fs.readFileSync(path.join(root, '../../shared/elements/category-registry.json'), 'utf8'));
const seeds = JSON.parse(fs.readFileSync(path.join(root, '../../shared/elements/core-element-seeds.json'), 'utf8'));
assert.equal(Protocol.validateCategoryRegistry(categories).pass, true);
assert.equal(categories.categories.length, 8);
assert.equal(seeds.seeds.length, 16);

console.log('element-foundry selftest: PASS / future surface / exact element contracts / no promotion authority');
