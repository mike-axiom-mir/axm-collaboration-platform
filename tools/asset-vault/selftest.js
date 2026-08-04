'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { validateContract } = require('../../hub/module-contract-verifier');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(root, manifest.contract), 'utf8'));
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.equal(manifest.id, 'asset-vault');
assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.kind, 'product');
assert.equal(manifest.contract, 'module.contract.json');
assert.equal(contract.id, manifest.id);
assert.equal(contract.version, manifest.version);
assert.deepEqual(manifest.permissions, contract.permissions, 'manifest permissions must exactly match the contract');
assert.deepEqual(validateContract(contract, manifest), { pass: true, errors: [] });
assert(fs.existsSync(path.join(root, manifest.entry)), 'entry must exist');

for (const capability of manifest.supports) {
  assert(contract.provides.includes(capability), 'contract must provide manifest capability: ' + capability);
}
for (const refusal of ['automatic-folder-watching', 'automatic-asset-pack-zipping', 'automatic-launcher-card-installation', 'hidden-cloud-sync']) {
  assert(contract.boundaries.refuses.includes(refusal), 'missing refusal: ' + refusal);
}
assert(source.includes("AXM.init({id:'asset-vault',name:'AXM Asset Vault',version:'" + manifest.version + "'})"), 'runtime version must match manifest');
assert(source.includes("format:'axm-asset-vault',v:3"), 'portable backup format must remain explicit');
assert(source.includes("format:'axm-launcher-card-metadata',v:1"), 'launcher-card packet format must remain explicit');
assert(source.includes("schema:'axm.studio-asset/v1'"), 'Studio handoff schema must remain explicit');
assert(source.includes('AXMGate.submit'), 'meaningful mutations must remain gate-routed');
assert(source.includes("fetch('/api/export'"), 'explicit Workshop export fallback must remain visible');

console.log('Asset Vault selftest: PASS (declared contract, version parity, portable handoffs, explicit safety boundaries)');
