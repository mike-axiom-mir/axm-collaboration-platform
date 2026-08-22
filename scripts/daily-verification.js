#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const crypto = require('crypto');
const DiagnosticRedaction = require('../shared/readiness/diagnostic-redaction');

const root = path.resolve(__dirname, '..');
const checks = [
  { id: 'workshop-verify', file: 'verify.js' },
  { id: 'sensorium-retention-conformance', file: 'tests/sensorium-retention-conformance-test.js' }
];

function sha(value) { return crypto.createHash('sha256').update(String(value || '')).digest('hex'); }
function run(check) {
  const started = Date.now();
  const result = childProcess.spawnSync(process.execPath, [path.join(root, check.file)], { cwd: root, encoding: 'utf8', timeout: 180000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  const output = String(result.stdout || '') + '\n' + String(result.stderr || '');
  return { id: check.id, file: check.file, verdict: result.status === 0 ? 'PASS' : result.error && result.error.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'FAIL', exitCode: result.status, durationMs: Date.now() - started, outputSha256: sha(output), failureTail: result.status === 0 ? null : DiagnosticRedaction.failureTail(output, { workspaceRoot:root, limit:2000 }) };
}

const generatedAt = new Date();
const rows = checks.map(run);
const report = {
  schema: 'axm.daily-verification-receipt/v1',
  generatedAt: generatedAt.toISOString(),
  date: generatedAt.toISOString().slice(0, 10),
  verdict: rows.every(row => row.verdict === 'PASS') ? 'PASS' : 'FAIL',
  checks: rows,
  truth: { schedulerInstalled: false, readOnlyChecksOnly: true, automaticRepair: false }
};
const outputDir = path.join(root, 'exports', 'daily-verification');
fs.mkdirSync(outputDir, { recursive: true });
const outputFile = path.join(outputDir, report.date + '.json');
fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + '\n');
console.log('daily verification: ' + report.verdict + ' · ' + path.relative(root, outputFile));
rows.forEach(row => console.log('  ' + row.verdict + ' ' + row.id + ' ' + row.durationMs + 'ms'));
if (report.verdict !== 'PASS') process.exitCode = 1;
