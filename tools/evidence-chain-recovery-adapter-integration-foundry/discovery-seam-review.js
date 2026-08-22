#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const contract = JSON.parse(read('module.contract.json'));
const core = read('evidence-chain-recovery-adapter-integration-core.js');
const app = read('app.js');
const html = read('index.html');

assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.kind, 'product');
assert.equal(manifest.status, 'TEST');
assert.equal(manifest.risk, 'HIGH');
assert.deepEqual(manifest.permissions, []);
assert.equal(contract.schema, 'axm.module-contract/v1');
assert(contract.provides.includes('capability.plan.evidence-chain-recovery-adapter-integration/v1'));
assert(contract.consumes.includes('capability.verify.evidence-chain-recovery-adapter/v1'));
assert(contract.consumes.includes('deny-by-default-permission-status'));
assert(contract.boundaries.refuses.includes('adapter-import-or-execution'));
assert(contract.boundaries.refuses.includes('candidate-staging-compatibility-claim'));
assert(contract.boundaries.refuses.includes('live-apply-or-rollback-claim'));
assert(core.includes("candidateTransport: 'ADAPTER_IMPLEMENTATION_REQUIRED'"));
assert(core.includes("'CANDIDATE_TO_RECOVERY_REQUEST_ADAPTER_NOT_IMPLEMENTED'"));
assert(core.includes("'ALLOWED_IDENTITY_NOT_VERIFIED'"));
assert(core.includes("'DENIED_IDENTITY_NOT_VERIFIED'"));
assert(core.includes("LIVE_CAPABILITY = 'capability.apply.evidence-chain-reviewed-recovery/v1'"));
assert(app.includes("fetch('../recovery-center/manifest.json'"));
assert(app.includes("fetch('../recovery-center/module.contract.json'"));
assert(!/eval\(|new Function|import\(/.test(app));
assert(html.includes('No adapter source is imported, parsed as code, installed, or called.'));
console.log('Evidence Chain Recovery Adapter Integration Foundry discovery seam: PASS');
