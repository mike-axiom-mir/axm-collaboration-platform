'use strict';

const assert = require('assert');
const path = require('path');
const Readiness = require('../../shared/readiness/tool-readiness');

function run() {
  const root = path.resolve(__dirname, '..', '..');
  const index = Readiness.buildIndex(root, { now: '2026-08-02T00:00:00.000Z', verificationResults: { results: [] } });
  const tool = index.tools.find(item => item.id === 'branch-module-return-gate');
  assert(tool, 'tool readiness discovery did not find branch-module-return-gate');
  assert.strictEqual(tool.folder, 'branch-module-return-gate');
  assert.strictEqual(tool.manifest.valid, true, tool.manifest.errors.join('; '));
  assert.strictEqual(tool.entry.exists, true, 'declared entry is not discoverable');
  assert.strictEqual(tool.contract.present, true, 'module contract is not discoverable');
  assert.strictEqual(tool.contract.valid, true, tool.contract.errors.join('; '));
  assert.strictEqual(tool.selftest.promotionPath, 'tools/branch-module-return-gate/selftest.js');
  return {
    schema: 'axm.discovery-seam-review/v1',
    pass: true,
    id: tool.id,
    discovery: {
      manifest: tool.manifest.path,
      entry: tool.entry.path,
      contract: tool.contract.path,
      selftest: tool.selftest.promotionPath
    },
    promotion: tool.promotion,
    truth: { discovered: true, moduleFolderPresent: true, candidateInstalled: false, promotedBeyondTest: false, canon: false }
  };
}

if (require.main === module) {
  try { process.stdout.write(JSON.stringify(run(), null, 2) + '\n'); }
  catch (error) { process.stderr.write((error.stack || error.message) + '\n'); process.exitCode = 1; }
}

module.exports = { run };
