#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const contract = JSON.parse(read('module.contract.json'));
const core = read('evidence-chain-recovery-adapter-conformance-core.js');
const runner = read('conformance-runner.js');
const reference = read('reference-fixture-adapter.js');
const html = read('index.html');

assert.equal(manifest.schema, 'axm.tool-manifest/v1');
assert.equal(manifest.kind, 'product');
assert.equal(manifest.status, 'TEST');
assert.equal(manifest.risk, 'HIGH');
assert.deepEqual(manifest.permissions, []);
assert.equal(manifest.entry, 'index.html');
assert.equal(contract.schema, 'axm.module-contract/v1');
assert(contract.provides.includes('capability.verify.evidence-chain-recovery-adapter/v1'));
assert(contract.consumes.includes('capability.drill.evidence-chain-recovery-application/v1'));
assert(contract.boundaries.refuses.includes('live-target-access'));
assert(contract.boundaries.refuses.includes('adapter-module-path-loading'));
assert(contract.boundaries.refuses.includes('permission-request-or-grant'));
assert(contract.boundaries.refuses.includes('live-apply-capability-claim'));
assert(core.includes("LIVE_CAPABILITY = 'capability.apply.evidence-chain-reviewed-recovery/v1'"));
assert(core.includes('productionAdapterEvidenceRequired'));
['FIXTURE_PERMISSION_DENIAL', 'EXACT_APPLY_CONFIRMATION', 'STALE_PREVIEW_REFUSAL', 'CANDIDATE_DIGEST_MISMATCH_REFUSAL', 'CURRENT_STATE_DRIFT_REFUSAL', 'APPLY_INSPECT_ROLLBACK', 'DIGEST_ONLY_RECEIPT_PRIVACY'].forEach(code => assert(runner.includes(code)));
['ALLOW_PERMISSION_DENIED', 'ACCEPT_STALE_PREVIEW', 'ACCEPT_TAMPERED_CANDIDATE', 'ACCEPT_CURRENT_STATE_DRIFT', 'BROKEN_ROLLBACK', 'LEAK_TARGET_PATH'].forEach(code => assert(reference.includes(code)));
assert(html.includes('No production adapter is executed'));
assert(html.includes('Live authorization remains unverified'));
console.log('Evidence Chain Recovery Adapter Conformance Lab discovery seam: PASS');
