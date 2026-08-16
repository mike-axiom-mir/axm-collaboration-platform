#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Generator = require('./generate-tools-index');

let checks = 0;
function check(label, action) {
  action();
  checks += 1;
  process.stdout.write('PASS ' + label + '\n');
}

function tool(id, status, digest, promotionPath) {
  return {
    id,
    status,
    selftest: {
      promotionPath: promotionPath === false ? null : 'tools/' + id + '/selftest.js',
      sha256: digest
    }
  };
}

const preliminary = {
  tools: [
    tool('alpha', 'WORKING', 'sha-alpha'),
    tool('beta', 'TEST', 'sha-beta'),
    tool('delta', 'CANON', 'sha-delta'),
    tool('gamma', 'EXPERIMENTAL', 'sha-gamma'),
    tool('no-selftest', 'WORKING', null, false)
  ]
};

check('default options preserve the full non-verifying route', () => {
  assert.deepEqual(Generator.parseOptions([]), { verify: false, selectedToolIds: [], workers: 2, timeoutMs: 45000 });
});

check('selected ids are trimmed, deduplicated and sorted within bounds', () => {
  assert.deepEqual(Generator.parseOptions(['--verify', '--tool=beta, alpha', '--tool=alpha', '--workers=99', '--timeout-ms=1']), {
    verify: true,
    selectedToolIds: ['alpha', 'beta'],
    workers: 4,
    timeoutMs: 1000
  });
});

check('tool selection requires verification mode', () => {
  assert.throws(() => Generator.parseOptions(['--tool=alpha']), /requires --verify/);
});

check('empty tool selections fail closed', () => {
  assert.throws(() => Generator.parseOptions(['--verify', '--tool=']), /non-empty tool id/);
  assert.throws(() => Generator.parseOptions(['--verify', '--tool=alpha,']), /empty tool id/);
});

check('full verification selects every eligible target', () => {
  assert.deepEqual(Generator.verificationTargets(preliminary, []).map(row => row.id), ['alpha', 'beta', 'delta']);
});

check('scoped verification selects only the requested eligible targets', () => {
  assert.deepEqual(Generator.verificationTargets(preliminary, ['beta', 'alpha']).map(row => row.id), ['beta', 'alpha']);
});

check('unknown and ineligible target ids fail before execution', () => {
  assert.throws(() => Generator.verificationTargets(preliminary, ['missing']), /unknown tool id/);
  assert.throws(() => Generator.verificationTargets(preliminary, ['gamma']), /not an eligible verification target/);
  assert.throws(() => Generator.verificationTargets(preliminary, ['no-selftest']), /not an eligible verification target/);
});

const existingReceipt = {
  schema: Generator.RECEIPT_SCHEMA,
  generatedAt: '2026-08-01T00:00:00.000Z',
  results: [
    { id: 'alpha', selftestSha256: 'sha-alpha', verdict: 'PASS' },
    { id: 'beta', selftestSha256: 'sha-beta', verdict: 'PASS' },
    { id: 'delta', selftestSha256: 'stale-delta', verdict: 'PASS' },
    { id: 'gamma', selftestSha256: 'sha-gamma', verdict: 'PASS' }
  ]
};

check('selected receipt merge replaces selected rows and retains only digest-current eligible rows', () => {
  const receipt = Generator.buildVerificationReceipt({
    preliminary,
    existingReceipt,
    latestResults: [{ id: 'alpha', selftestSha256: 'sha-alpha', verdict: 'FAIL' }],
    selectedToolIds: ['alpha'],
    workers: 1,
    timeoutMs: 5000,
    generatedAt: '2026-08-16T00:00:00.000Z'
  });
  assert.equal(receipt.scope.mode, 'SELECTED');
  assert.deepEqual(receipt.scope.selectedToolIds, ['alpha']);
  assert.equal(receipt.scope.retainedCurrentResults, 1);
  assert.deepEqual(receipt.results.map(row => row.id), ['alpha', 'beta']);
  assert.equal(receipt.results[0].verdict, 'FAIL');
  assert.equal(receipt.results[1].verdict, 'PASS');
});

check('selected receipt merge requires exactly one latest row per selected id', () => {
  assert.throws(() => Generator.buildVerificationReceipt({ preliminary, existingReceipt, latestResults: [], selectedToolIds: ['alpha'], workers: 1, timeoutMs: 5000 }), /did not produce/);
  assert.throws(() => Generator.buildVerificationReceipt({ preliminary, existingReceipt, latestResults: [{ id: 'beta', selftestSha256: 'sha-beta', verdict: 'PASS' }], selectedToolIds: ['alpha'], workers: 1, timeoutMs: 5000 }), /did not produce/);
});

check('latest rows must be eligible, digest-current and use a supported verdict', () => {
  assert.throws(() => Generator.buildVerificationReceipt({ preliminary, latestResults: [{ id: 'gamma', selftestSha256: 'sha-gamma', verdict: 'PASS' }], selectedToolIds: ['gamma'], workers: 1, timeoutMs: 5000 }), /eligible target/);
  assert.throws(() => Generator.buildVerificationReceipt({ preliminary, latestResults: [{ id: 'alpha', selftestSha256: 'stale', verdict: 'PASS' }], selectedToolIds: ['alpha'], workers: 1, timeoutMs: 5000 }), /digest does not match/);
  assert.throws(() => Generator.buildVerificationReceipt({ preliminary, latestResults: [{ id: 'alpha', selftestSha256: 'sha-alpha', verdict: 'UNKNOWN' }], selectedToolIds: ['alpha'], workers: 1, timeoutMs: 5000 }), /unsupported verdict/);
});

check('full receipts never retain unrelated historical rows', () => {
  const receipt = Generator.buildVerificationReceipt({
    preliminary,
    existingReceipt,
    latestResults: [
      { id: 'alpha', selftestSha256: 'sha-alpha', verdict: 'PASS' },
      { id: 'beta', selftestSha256: 'sha-beta', verdict: 'PASS' },
      { id: 'delta', selftestSha256: 'sha-delta', verdict: 'PASS' }
    ],
    selectedToolIds: [],
    workers: 2,
    timeoutMs: 45000,
    generatedAt: '2026-08-16T00:00:00.000Z'
  });
  assert.equal(receipt.scope.mode, 'FULL');
  assert.equal(receipt.scope.retainedCurrentResults, 0);
  assert.deepEqual(receipt.results.map(row => row.id), ['alpha', 'beta', 'delta']);
});

check('full receipt construction rejects missing eligible results', () => {
  assert.throws(() => Generator.buildVerificationReceipt({
    preliminary,
    latestResults: [{ id: 'alpha', selftestSha256: 'sha-alpha', verdict: 'PASS' }],
    selectedToolIds: [],
    workers: 2,
    timeoutMs: 45000
  }), /full verification did not produce/);
});

check('receipt validation rejects incompatible schemas and duplicate ids', () => {
  assert.throws(() => Generator.validateReceipt({ schema: 'wrong', results: [] }), /must use/);
  assert.throws(() => Generator.validateReceipt({ schema: Generator.RECEIPT_SCHEMA, results: [{ id: 'alpha' }, { id: 'alpha' }] }), /duplicate/);
});

check('a valid checked-in index can seed digest-bound fallback evidence', () => {
  const result = { id: 'alpha', selftestSha256: 'sha-alpha', verdict: 'PASS' };
  const receipt = Generator.receiptFromIndex({
    schema: 'axm.tools-index/v1',
    generatedAt: '2026-08-01T00:00:00.000Z',
    sourceDigest: 'a'.repeat(64),
    promotionQueue: {},
    capabilities: [],
    tools: [{ id: 'alpha', status: 'TEST', selftest: { result }, promotion: { state: 'BLOCKED' } }],
    truth: { automaticPromotion: false }
  });
  assert.equal(receipt.schema, Generator.RECEIPT_SCHEMA);
  assert.deepEqual(receipt.results, [result]);
});

check('checked-in fallback evidence fails closed when its index contract is invalid', () => {
  assert.throws(() => Generator.receiptFromIndex({ schema: 'wrong', tools: [] }), /cannot preserve prior evidence/);
});

process.stdout.write('generate-tools-index scoped refresh selftest: PASS (' + checks + ' checks)\n');
