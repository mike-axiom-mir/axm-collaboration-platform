#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Readiness = require('./tool-readiness');
const ReadinessObserver = require('./readiness-observer');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-readiness-observer-'));
const toolRoot = path.join(root, 'tools', 'alpha');
const stateRoot = path.join(root, 'state');
const receiptFile = path.join(stateRoot, 'tool-readiness', 'latest-selftests.json');
const indexFile = path.join(root, 'tools-index.json');
fs.mkdirSync(toolRoot, { recursive: true });
fs.mkdirSync(path.dirname(receiptFile), { recursive: true });

const manifest = {
  schema: 'axm.tool-manifest/v1',
  kind: 'product',
  id: 'alpha',
  name: 'Alpha',
  version: 'v1',
  status: 'TEST',
  entry: 'index.html',
  contract: 'module.contract.json',
  uses: [],
  permissions: []
};
const contract = {
  schema: 'axm.module-contract/v1',
  id: 'alpha',
  version: 'v1',
  provides: ['alpha.read/v1'],
  consumes: [],
  permissions: [],
  handoffs: { emits: [], accepts: [] },
  boundaries: { refuses: ['automatic-promotion'] }
};
fs.writeFileSync(path.join(toolRoot, 'manifest.json'), JSON.stringify(manifest));
fs.writeFileSync(path.join(toolRoot, 'module.contract.json'), JSON.stringify(contract));
fs.writeFileSync(path.join(toolRoot, 'index.html'), '<!doctype html><title>Alpha</title>');
fs.writeFileSync(path.join(toolRoot, 'selftest.js'), "console.log('PASS');\n");

const preliminary = Readiness.buildIndex(root);
const verificationResults = {
  schema: 'axm.tool-selftest-results/v1',
  results: [{
    id: 'alpha',
    selftestSha256: preliminary.tools[0].selftest.sha256,
    verdict: 'PASS'
  }]
};
fs.writeFileSync(receiptFile, JSON.stringify(verificationResults));
fs.writeFileSync(indexFile, JSON.stringify(Readiness.buildIndex(root, { verificationResults })));

const observer = ReadinessObserver.create({ root, stateRoot, humanGate: 'Mike' });
const current = observer.snapshot();
assert.equal(current.schema, ReadinessObserver.VIEW_SCHEMA);
assert.equal(current.state, 'CURRENT');
assert.equal(current.summary.reviewCandidates, 1);
assert.equal(current.reviewCandidates[0].id, 'alpha');
assert.equal(current.reviewCandidates[0].humanDecisionRequired, true);
assert.equal(current.reviewCandidates[0].moduleRoute, '/tools/alpha/index.html');
assert.equal(current.reviewCandidates[0].evidencePaths.manifest, 'tools/alpha/manifest.json');
assert.equal(current.reviewCandidates[0].evidencePaths.contract, 'tools/alpha/module.contract.json');
assert.equal(current.reviewCandidates[0].evidencePaths.selftest, 'tools/alpha/selftest.js');
assert.equal(current.authority.humanPromotionRequired, true);
assert.equal(current.authority.humanGate, 'Mike');
assert.equal(current.truth.automaticPromotion, false);

manifest.summary = 'Changed after the index was built.';
fs.writeFileSync(path.join(toolRoot, 'manifest.json'), JSON.stringify(manifest));
assert.equal(observer.snapshot().state, 'STALE');

fs.writeFileSync(indexFile, '{}');
assert.equal(observer.snapshot().state, 'INVALID');
fs.writeFileSync(indexFile, '{');
assert.equal(observer.snapshot().state, 'INVALID');
fs.rmSync(indexFile);
assert.equal(observer.snapshot().state, 'UNAVAILABLE');

fs.rmSync(root, { recursive: true, force: true });
console.log('readiness observer selftest: PASS (CURRENT, STALE, INVALID, UNAVAILABLE; review routes and human gate preserved)');
