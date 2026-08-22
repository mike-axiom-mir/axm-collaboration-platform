'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Service = require('./catalog-service');
const ContractVerifier = require('../../hub/module-contract-verifier');

const root = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
const contractCheck = ContractVerifier.validateContract(contract, manifest);
assert.deepEqual(contractCheck.errors, []);
assert.equal(contractCheck.pass, true);

const assets = Service.listAssets();
assert.equal(assets.length, 10);
assert.equal(new Set(assets.map(item => item.identity)).size, 10);
assert.equal(Service.resolve('AXM-CRATE-001', '0.4.0').identity, 'AXM-CRATE-001@0.4.0');
assert.throws(() => Service.resolve('AXM-CRATE-001', '9.9.9'), /not found/);
assert.throws(() => Service.resolve('AXM-CRATE-001'), /required/);

const receipt = Service.verifyStage();
assert.equal(receipt.status, 'PASS-WITH-DECLARED-WARN');
assert.equal(receipt.assetCount, 10);
assert.equal(receipt.checksumCount, 668);
assert.deepEqual(receipt.manufacturingFiles, []);
assert.equal(receipt.errors.length, 0);
assert.ok(receipt.warnings.includes('AXM-ENERGY-CORE-001: declared object WARN preserved'));
if (fs.existsSync(path.join(Service.INTAKE_ROOT, 'source', 'AXM_UNIVERSAL_OBJECT_FABRIC_COMPLETE_INTAKE_v0_7_0_2026-07-28.zip'))) {
  assert.equal(receipt.sourceSha256, Service.EXPECTED_SOURCE_SHA256);
} else {
  assert.equal(receipt.sourceSha256, null);
  assert.ok(receipt.warnings.includes('accepted source archive omitted from public-safe snapshot; signed digest receipt preserved'));
}

const appSource = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
new Function(appSource);
assert.match(appSource, /STAGE_RESOLUTION_MAP\.json/);
assert.match(appSource, /Runtime Capsule/);
assert.match(appSource, /STAGED-NOT-INTEGRATED/);

const stage = Service.STAGE_ROOT;
const three = fs.readFileSync(path.join(stage, 'shared', 'integration', 'threejs', 'axm-universal-object.js'), 'utf8');
const godot = fs.readFileSync(path.join(stage, 'shared', 'integration', 'godot', 'AXMUniversalObject.gd'), 'utf8');
assert.match(three, /AXMUniversalObjectLoader/);
assert.match(three, /selectLOD/);
assert.match(godot, /class_name AXMUniversalObject/);
assert.match(godot, /select_lod/);

assert.ok(fs.existsSync(path.join(Service.INTAKE_ROOT, 'INTAKE_RECEIPT.json')));
console.log('Universal Object Fabric self-test passed: 10 exact identities, 668 checksums, source hash preserved, declared WARN visible');
