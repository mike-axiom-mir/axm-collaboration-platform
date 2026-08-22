'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateContract } = require('../../hub/module-contract-verifier');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, manifest.contract), 'utf8'));
const source = fs.readFileSync(path.join(root, 'pack-lab.js'), 'utf8');

assert.equal(manifest.id, 'asset-pack-lab');
assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.kind, 'product');
assert.equal(manifest.contract, 'module.contract.json');
assert.equal(contract.id, manifest.id);
assert.equal(contract.version, manifest.version);
assert.deepEqual(manifest.permissions, contract.permissions, 'manifest permissions must exactly match the contract');
assert.deepEqual(validateContract(contract, manifest), { pass: true, errors: [] });
assert(fs.existsSync(path.join(root, manifest.entry)), 'entry must exist');
assert(fs.existsSync(path.join(root, 'schemas', 'asset-pack.schema.json')), 'asset-pack schema must exist');
assert(fs.existsSync(path.join(root, 'schemas', 'template-shell.schema.json')), 'template-shell schema must exist');

for (const capability of manifest.supports) {
  assert(contract.provides.includes(capability), 'contract must provide manifest capability: ' + capability);
}
for (const refusal of ['automatic-pack-installation', 'automatic-launcher-consumption', 'asset-file-copying']) {
  assert(contract.boundaries.refuses.includes(refusal), 'missing refusal: ' + refusal);
}
assert(source.includes("format:'axm-asset-pack', v:1"), 'pack format must stay explicit');
assert(source.includes("format:'axm-template-shell', v:1"), 'template format must stay explicit');
assert(source.includes('AXMGate.submit'), 'meaningful builds must remain gate-routed');
assert(source.includes('AXM.store.save'), 'draft manifests must remain resumable');
assert(source.includes("fetch('/api/export'"), 'explicit Workshop export fallback must remain visible');

console.log('Asset Pack Lab selftest: PASS (declared contract, bounded manifest outputs, explicit export boundaries)');
