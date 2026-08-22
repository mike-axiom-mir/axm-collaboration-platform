#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Readiness = require('./tool-readiness');

const root = path.resolve(__dirname, '..', '..');
const first = Readiness.buildIndex(root, { now: '2026-07-23T00:00:00.000Z' });
const second = Readiness.buildIndex(root, { now: '2026-07-23T00:00:00.000Z' });
assert.deepEqual(Readiness.validateIndex(first), { pass: true, errors: [] });
assert.equal(first.sourceDigest, second.sourceDigest, 'same source produces the same digest');
assert.equal(first.summary.tools, first.tools.length);
assert.ok(first.tools.length >= 100, 'full Workshop inventory is represented');
assert.equal(first.truth.automaticPromotion, false);
assert.equal(first.truth.selftestPassIsHumanApproval, false);
assert.ok(first.capabilities.every(row => Array.isArray(row.providers) && Array.isArray(row.consumers)));
const bad = Readiness.validateTargetManifest({ id: 'wrong', name: 'Wrong', version: '1', status: 'TEST', entry: 'index.html', uses: [], permissions: [] }, 'folder');
assert.ok(bad.some(message => message.startsWith('id must equal folder name')));

assert.equal(typeof Readiness.isVerificationTarget, 'function', 'verification target policy is exported for generators and tests');
assert.equal(Readiness.isVerificationTarget({ status: 'TEST', selftest: { promotionPath: 'tools/test/selftest.js' } }), true);
assert.equal(Readiness.isVerificationTarget({ status: 'WORKING', selftest: { promotionPath: 'tools/working/selftest.js' } }), true);
assert.equal(Readiness.isVerificationTarget({ status: 'CANON', selftest: { promotionPath: 'tools/canon/selftest.js' } }), true);
assert.equal(Readiness.isVerificationTarget({ status: 'EXPERIMENTAL', selftest: { promotionPath: 'tools/experimental/selftest.js' } }), false);

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-readiness-policy-'));
try {
  const toolRoot = path.join(fixtureRoot, 'tools', 'working-tool');
  fs.mkdirSync(toolRoot, { recursive: true });
  fs.writeFileSync(path.join(toolRoot, 'manifest.json'), JSON.stringify({
    schema: 'axm.tool-manifest/v1',
    kind: 'product',
    id: 'working-tool',
    name: 'Working Tool',
    version: 'v1',
    status: 'WORKING',
    entry: 'index.html',
    contract: 'module.contract.json',
    uses: [],
    permissions: [],
    verifiedAt: '2026-07-28T00:00:00.000Z'
  }));
  fs.writeFileSync(path.join(toolRoot, 'module.contract.json'), JSON.stringify({
    schema: 'axm.module-contract/v1',
    id: 'working-tool',
    version: 'v1',
    provides: ['working-tool.read/v1'],
    consumes: [],
    permissions: [],
    handoffs: { emits: [], accepts: [] },
    boundaries: { refuses: ['automatic-promotion'] }
  }));
  fs.writeFileSync(path.join(toolRoot, 'index.html'), '<!doctype html><title>Working Tool</title>');
  fs.writeFileSync(path.join(toolRoot, 'selftest.js'), "console.log('PASS');\n");

  const noReceipt = Readiness.buildIndex(fixtureRoot, { now: '2026-07-28T12:00:00.000Z' });
  const missingResultTool = noReceipt.tools[0];
  assert.equal(missingResultTool.promotion.state, 'CLAIM_NEEDS_REVERIFICATION');
  assert.ok(missingResultTool.promotion.blockers.includes('current selftest PASS result is missing'));

  const passReceipt = {
    schema: 'axm.tool-selftest-results/v1',
    results: [{ id: 'working-tool', selftestSha256: missingResultTool.selftest.sha256, verdict: 'PASS' }]
  };
  const current = Readiness.buildIndex(fixtureRoot, { now: '2026-07-28T12:00:00.000Z', verificationResults: passReceipt });
  assert.equal(current.tools[0].promotion.state, 'CURRENT');
  assert.equal(current.tools[0].selftest.result.verdict, 'PASS');
  assert.deepEqual(Readiness.validateIndex(current), { pass: true, errors: [] });

  const fixtureCredential = ['axm', 'fixture', 'credential'].join('-');
  const failed = Readiness.buildIndex(fixtureRoot, {
    now: '2026-07-28T12:00:00.000Z',
    verificationResults: { schema: 'axm.tool-selftest-results/v1', results: [{
      id: 'working-tool', selftestSha256: missingResultTool.selftest.sha256, verdict: 'FAIL',
      failureTail:'Authorization: Bearer ' + fixtureCredential + '\nError at ' + path.join(fixtureRoot, 'tools', 'working-tool', 'selftest.js') + ':7:1'
    }] }
  });
  assert.equal(failed.tools[0].promotion.state, 'CLAIM_NEEDS_REVERIFICATION');
  assert.ok(failed.tools[0].promotion.blockers.includes('current selftest did not pass'));
  assert.ok(failed.tools[0].selftest.result.failureTail.includes('<WORKSPACE>'), 'derived index retains a portable diagnostic suffix');
  assert.ok(!failed.tools[0].selftest.result.failureTail.includes(fixtureRoot), 'derived index removes its absolute fixture root');
  assert.ok(failed.tools[0].selftest.result.failureTail.includes('<REDACTED_CREDENTIAL>'), 'derived index retains an explicit credential-redaction marker');
  assert.ok(!failed.tools[0].selftest.result.failureTail.includes(fixtureCredential), 'derived index removes recognized credential evidence');
  assert.equal(failed.truth.failureDiagnosticsMachinePathRedacted, true, 'index truth declares diagnostic path redaction');
  assert.equal(failed.truth.failureDiagnosticsRecognizedCredentialEvidenceRedacted, true, 'index truth declares recognized diagnostic credential redaction');

  const missingCredentialTruth = JSON.parse(JSON.stringify(failed));
  delete missingCredentialTruth.truth.failureDiagnosticsRecognizedCredentialEvidenceRedacted;
  assert.ok(Readiness.validateIndex(missingCredentialTruth).errors.includes('failure diagnostics must declare recognized credential-evidence redaction'));

  const stale = Readiness.buildIndex(fixtureRoot, {
    now: '2026-07-28T12:00:00.000Z',
    verificationResults: { schema: 'axm.tool-selftest-results/v1', results: [{ id: 'working-tool', selftestSha256: '0'.repeat(64), verdict: 'PASS' }] }
  });
  assert.equal(stale.tools[0].promotion.state, 'CLAIM_NEEDS_REVERIFICATION');
  assert.ok(stale.tools[0].promotion.blockers.includes('selftest result is stale for the current selftest digest'));

  const tampered = JSON.parse(JSON.stringify(current));
  tampered.tools[0].selftest.result = null;
  assert.ok(Readiness.validateIndex(tampered).errors.some(message => message.includes('CURRENT requires a digest-bound PASS')));
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
console.log('tool readiness selftest: PASS (' + first.tools.length + ' tools, ' + first.summary.capabilities + ' capabilities)');
