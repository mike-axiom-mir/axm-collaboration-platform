#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');

const ROOT = path.resolve(__dirname, '../../..');
const OUTPUT = path.join(__dirname, 'KNOWN_SOURCE_EVOLUTION.json');
const CASES = [
  ['stewardship-frontier-source-digests', 'docs/steward-runs/2026-08-19-grounded-growth-stewardship-frontier/selftest.js', /source digest matches current bytes/i],
  ['knowledge-frontier-source-digests', 'docs/steward-runs/2026-08-19-grounded-growth-knowledge-frontier/selftest.js', /source digest rebuild exactly/i],
  ['participation-frontier-verification-source-digests', 'docs/steward-runs/2026-08-19-grounded-growth-participation-frontier/selftest.js', /verification receipt and every declared source digest rebuild exactly/i],
  ['human-handoff-readiness-source', 'docs/steward-runs/2026-08-19-human-handoff-operational-readiness/selftest.js', /PORTFOLIO_READINESS_RECEIPT\.json differs from exact current sources/i],
  ['portfolio-readiness-source', 'docs/steward-runs/2026-08-19-human-readiness-portfolio-coverage/selftest.js', /PORTFOLIO_READINESS_RECEIPT\.json differs from exact current sources/i],
  ['bridge-readiness-source', 'docs/steward-runs/2026-08-19-reuse-existing-human-bridge-ancestry/selftest.js', /PORTFOLIO_READINESS_RECEIPT\.json differs from exact current sources/i],
  ['human-route-coverage-source', 'docs/steward-runs/2026-08-20-grounded-growth-human-route-coverage/selftest.js', /PORTFOLIO_READINESS_RECEIPT\.json differs from exact current sources/i],
  ['signal-lineage-source', 'docs/steward-runs/2026-08-20-grounded-growth-signal-lineage/selftest.js', /recorded signal-lineage artifacts differ from exact rebuild/i],
  ['outcome-evolution-source-digests', 'docs/steward-runs/2026-08-19-verification-evolution-grounded-growth/selftest.js', /verification receipt rebuilds exactly/i],
  ['current-convergence-source-digests', 'docs/steward-runs/2026-08-19-grounded-growth-current-convergence/selftest.js', /verification receipt and every declared source digest rebuild exactly/i],
  ['current-state-portability-recorded-evolution', 'docs/steward-runs/2026-08-19-grounded-growth-current-state-portability/selftest.js', /five prior tracked module sources record later evolution/i]
];

function rawSha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(value).digest('hex');
}

function execute(entry) {
  const [id, relativePath, expectedPattern] = entry;
  const result = childProcess.spawnSync(process.execPath, [relativePath], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    env: { ...process.env, AXM_TEST_TEMP: os.tmpdir() }
  });
  const output = String(result.stderr || '') + '\n' + String(result.stdout || '');
  const expectedFailure = result.status !== 0 && expectedPattern.test(output);
  return {
    id,
    command: 'node ' + relativePath,
    verdict: expectedFailure ? 'EXPECTED_STALE_AFTER_SOURCE_CHANGE' : result.status === 0 ? 'UNEXPECTED_PASS' : 'UNEXPECTED_FAILURE',
    reason: expectedFailure
      ? 'dated verification binds a prior source identity; current product and native behavior are checked separately'
      : 'historical source-evolution classification no longer matches its declared boundary'
  };
}

function build() {
  const results = CASES.map(execute);
  const receipt = {
    schema: 'axm.grounded-growth-known-source-evolution/v1',
    version: '0.1.0',
    generatedAt: '2026-08-20T04:52:00.000Z',
    status: 'TEST',
    results,
    summary: {
      total: results.length,
      expectedStale: results.filter((item) => item.verdict === 'EXPECTED_STALE_AFTER_SOURCE_CHANGE').length,
      unexpected: results.filter((item) => item.verdict !== 'EXPECTED_STALE_AFTER_SOURCE_CHANGE').length
    },
    rawStdoutRetained: false,
    rawStderrRetained: false,
    historicalReceiptsRewritten: false,
    digest: null
  };
  const payload = JSON.parse(Core.canonicalJson(receipt));
  delete payload.digest;
  receipt.digest = rawSha256(Core.canonicalJson(payload));
  return receipt;
}

function write() {
  const result = build();
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n', 'utf8');
  return result;
}

function checkRecorded() {
  const expected = build();
  const actual = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  if (Core.canonicalJson(actual) !== Core.canonicalJson(expected)) throw new Error('known source-evolution receipt differs from current evidence');
  return expected;
}

if (require.main === module) {
  const result = process.argv.includes('--write') ? write() : checkRecorded();
  process.stdout.write(JSON.stringify(result.summary) + '\n');
  if (result.summary.unexpected) process.exitCode = 1;
}

module.exports = { ROOT, OUTPUT, CASES, build, write, checkRecorded };
