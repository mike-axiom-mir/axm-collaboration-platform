'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Readiness = require('../../shared/readiness/tool-readiness');
const Needs = require('../../shared/modular-intake/needs-observatory-service');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-needs-readiness-'));
const stateRoot = path.join(root, 'state');
const toolRoot = path.join(root, 'tools', 'review-candidate');
const indexFile = path.join(root, 'tools-index.json');
const receiptFile = path.join(stateRoot, 'tool-readiness', 'latest-selftests.json');

const manifest = {
  schema: 'axm.tool-manifest/v1',
  kind: 'product',
  id: 'review-candidate',
  name: 'Review Candidate',
  version: 'v1.0',
  status: 'TEST',
  entry: 'index.html',
  contract: 'module.contract.json',
  uses: [],
  permissions: []
};
const contract = {
  schema: 'axm.module-contract/v1',
  id: 'review-candidate',
  version: 'v1.0',
  provides: ['example.capability/v1'],
  consumes: [],
  permissions: [],
  handoffs: { emits: [], accepts: [] },
  boundaries: { writes: [], refuses: ['automatic-promotion'] },
  lifecycle: { state_owner: 'none', reload: 'not-applicable', disconnect: 'not-applicable', cleanup: 'not-applicable' }
};
const intake = { status() { return { promoted: [], candidates: [], backup: { configured: true, truth: 'configured' } }; } };

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

try {
  fs.mkdirSync(toolRoot, { recursive: true });
  writeJson(path.join(toolRoot, 'manifest.json'), manifest);
  writeJson(path.join(toolRoot, 'module.contract.json'), contract);
  fs.writeFileSync(path.join(toolRoot, 'index.html'), '<!doctype html>\n');
  fs.writeFileSync(path.join(toolRoot, 'selftest.js'), "'use strict';\n");

  const preliminary = Readiness.buildIndex(root);
  const indexedTool = preliminary.tools.find(tool => tool.id === manifest.id);
  const verificationResults = {
    schema: 'axm.tool-selftest-results/v1',
    generatedAt: new Date().toISOString(),
    results: [{ id: manifest.id, path: indexedTool.selftest.promotionPath, selftestSha256: indexedTool.selftest.sha256, verdict: 'PASS', exitCode: 0, durationMs: 1 }]
  };
  writeJson(receiptFile, verificationResults);
  writeJson(indexFile, Readiness.buildIndex(root, { verificationResults }));

  const service = Needs.create({ root, stateRoot, modularIntakeService: intake });
  const need = service.createNeed({ title: 'Keep review separate from acceptance', requiredCapabilities: ['example.capability/v1'] }, 'test');
  const status = service.status();
  assert.equal(status.readiness.schema, 'axm.workshop-readiness-view/v1');
  assert.equal(status.readiness.state, 'CURRENT');
  assert.deepEqual(status.readiness.reviewCandidates.map(item => item.id), ['review-candidate']);
  assert.equal(status.readiness.reviewCandidates[0].humanDecisionRequired, true);
  assert.equal(status.readiness.truth.selftestPassIsHumanApproval, false);
  assert.ok(status.readiness.authority.reviewCandidateDoesNotMean.includes('need-satisfied'));
  assert.equal(status.needs.find(item => item.id === need.id).state, 'OPEN');
  assert.equal(status.needs.find(item => item.id === need.id).computedState, undefined);

  writeJson(path.join(toolRoot, 'manifest.json'), Object.assign({}, manifest, { version: 'v1.1' }));
  const stale = service.readinessSnapshot();
  assert.equal(stale.state, 'STALE');
  assert.deepEqual(stale.reviewCandidates, []);

  writeJson(indexFile, {});
  assert.equal(service.readinessSnapshot().state, 'INVALID');
  fs.writeFileSync(indexFile, '{');
  assert.equal(service.readinessSnapshot().state, 'INVALID');
  fs.rmSync(indexFile, { force: true });
  assert.equal(service.readinessSnapshot().state, 'UNAVAILABLE');

  console.log('workshop readiness composition self-test passed · 13 assertions');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
