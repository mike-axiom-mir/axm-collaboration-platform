#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ContractVerifier = require('../../hub/module-contract-verifier');

const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
const contract = JSON.parse(fs.readFileSync(path.join(__dirname, 'module.contract.json'), 'utf8'));
const html = fs.readFileSync(path.join(__dirname, manifest.entry), 'utf8');
assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.ok(Array.isArray(manifest.uses) && Array.isArray(manifest.permissions));
assert.ok(['product', 'service', 'scaffold', 'adapter', 'machine-capability'].includes(manifest.kind));
assert.ok(fs.existsSync(path.join(__dirname, manifest.entry)));
assert.deepEqual(ContractVerifier.validateContract(contract, manifest), { pass: true, errors: [] });
assert.ok(/<html\b[^>]*\blang=/i.test(html));
assert.ok(/name=["']viewport["']/i.test(html));
assert.ok(/:focus-visible/.test(html));
assert.ok(/min-height:44px/.test(html));
console.log('module template selftest: PASS');
