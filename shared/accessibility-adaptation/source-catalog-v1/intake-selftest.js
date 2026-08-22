#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});

const index = readJson(path.join(root, 'PACKET_INDEX.json'));
assert.equal(index.module_count, 100);
assert.equal(index.package_count, 8);
assert.equal(index.packets.length, 100);
assert.equal(new Set(index.packets.map(packet => packet.module_id)).size, 100);

const packageFiles = fs.readdirSync(path.join(root, 'packages')).filter(name => name.endsWith('.json'));
assert.equal(packageFiles.length, 8);
const packagedIds = new Set();
packageFiles.forEach(name => {
  const packet = readJson(path.join(root, 'packages', name));
  packet.module_ids.forEach(id => {
    assert(!packagedIds.has(id), 'module appears in two packages: ' + id);
    packagedIds.add(id);
  });
});
assert.equal(packagedIds.size, 100);

const families = new Set();
index.packets.forEach(entry => {
  const folder = path.join(root, entry.path);
  const required = ['README.txt', 'contract.summary.json', 'module.packet.json', 'tests.summary.json'];
  required.forEach(name => assert(fs.existsSync(path.join(folder, name)), entry.module_id + ' missing ' + name));
  const moduleFile = path.join(folder, 'module.packet.json');
  assert.equal(digest(moduleFile), entry.packet_sha256, entry.module_id + ' packet digest mismatch');
  const packet = readJson(moduleFile);
  const contract = readJson(path.join(folder, 'contract.summary.json'));
  const tests = readJson(path.join(folder, 'tests.summary.json'));
  assert.equal(packet.module_id, entry.module_id);
  assert.equal(packet.package, entry.package);
  assert.equal(packet.activation_default, 'DISABLED');
  assert.equal(packet.real_accessibility_effect, 'NOT_PROVEN');
  assert.equal(contract.module_id, entry.module_id);
  assert.equal(contract.authority.apply, false);
  assert.equal(contract.authority.promotion, false);
  assert.equal(tests.module_id, entry.module_id);
  assert.equal(tests.real_evidence, 'NOT_RUN');
  families.add(packet.family);
  assert(packagedIds.has(entry.module_id), 'module is absent from package maps: ' + entry.module_id);
});
assert.equal(families.size, 10);

const retained = [
  ...walk(path.join(root, 'modules')),
  ...walk(path.join(root, 'packages')),
  ...['PACKET_INDEX.json', 'START_HERE.txt', 'VALIDATION_RESULT.json', 'validate_intake.py'].map(name => path.join(root, name))
];
assert.equal(retained.length, 412);
assert.equal(retained.reduce((sum, file) => sum + fs.statSync(file).size, 0), 2093017);
assert.equal(new Set(retained.map(digest)).size, 412);
assert.equal(retained.filter(file => /(?:\.pyc|\.zip)$/i.test(file)).length, 0);

const receipt = readJson(path.join(root, 'INTAKE_RECEIPT.json'));
assert.equal(receipt.accepted.module_packets, 100);
assert.equal(receipt.accepted.unique_content_hashes, 412);
assert.equal(receipt.excluded.source_redundant_copies, 23);
assert.equal(receipt.truth.packets_are_platform_native_implementations, false);

console.log('Accessibility & Adaptive Interfaces curated intake: PASS (100 disabled packets, 412 unique retained files)');
