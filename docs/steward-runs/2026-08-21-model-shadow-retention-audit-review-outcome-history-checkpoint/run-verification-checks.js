#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Core = require('../../../tools/deterministic-json-core');
const ROOT = path.resolve(__dirname, '../../..');
const prior = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/steward-runs/2026-08-21-model-shadow-retention-audit-review-outcome-ledger/CHECK_RESULTS.json'), 'utf8'));
const FOCUSED = [
  'node shared/model-shadow-retention-audit-review-outcome-history-checkpoint/selftest.js',
  ...prior.commands.filter(item => item.phase === 'FOCUSED').map(item => item.command)
];
const REQUIRED = prior.commands.filter(item => item.phase === 'REQUIRED').map(item => item.command);

function args(command) {
  const parts = command.split(' ');
  if (parts.shift() !== 'node' || parts.length !== 1 || !/^[A-Za-z0-9._/-]+\.js$/.test(parts[0]) || parts[0].includes('..')) {
    throw new Error('only one bounded relative Node.js check is supported');
  }
  return parts;
}

function assertionCount(output) {
  return Array.from(String(output || '').matchAll(/(?:SUMMARY\s+|RESULT\s+)?(\d+)\s+(?:focused\s+)?(?:assertions?|checks?|evidence groups?)\b/gi))
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function execute(command, phase) {
  const result = childProcess.spawnSync(process.execPath, args(command), {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, AXM_TEST_TEMP: os.tmpdir() }
  });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  const diagnostic = exitCode === 0 ? null : String(result.stderr || result.stdout || result.error || '').trim().slice(-2000);
  process.stdout.write((exitCode === 0 ? 'PASS ' : 'FAIL ') + command + '\n');
  if (diagnostic) process.stderr.write(diagnostic + '\n');
  return {
    command,
    phase,
    assertions: phase === 'FOCUSED' ? assertionCount(result.stdout) : 0,
    exitCode,
    verdict: exitCode === 0 ? 'PASS' : 'FAIL',
    diagnostic
  };
}

const commands = [];
FOCUSED.forEach(command => commands.push(execute(command, 'FOCUSED')));
REQUIRED.forEach(command => commands.push(execute(command, 'REQUIRED')));
const receipt = {
  schema: 'axm.verification-check-results/v1',
  status: commands.every(item => item.exitCode === 0) ? 'PASS' : 'FAIL',
  checkedAt: new Date().toISOString(),
  commands,
  summary: {
    commands: commands.length,
    passed: commands.filter(item => item.exitCode === 0).length,
    failed: commands.filter(item => item.exitCode !== 0).length,
    focusedAssertions: commands.reduce((sum, item) => sum + item.assertions, 0)
  },
  resultsDigest: null
};
const payload = JSON.parse(Core.canonicalJson(receipt));
delete payload.resultsDigest;
receipt.resultsDigest = 'sha256:' + crypto.createHash('sha256').update(Core.canonicalJson(payload)).digest('hex');
fs.writeFileSync(path.join(__dirname, 'CHECK_RESULTS.json'), JSON.stringify(receipt, null, 2) + '\n', 'utf8');
if (receipt.status !== 'PASS') process.exitCode = 1;
