#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const cwd = path.join(__dirname, 'proof-harness-v7');
const python = process.env.AXM_PYTHON || 'python';

function run(args) {
  const result = spawnSync(python, args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || 'source harness failed\n');
    process.exit(result.status || 1);
  }
  return result;
}

const harness = run(['-B', 'run_all_v7.py']);
const report = JSON.parse(harness.stdout);
assert.equal(report.passed, true);
assert.equal(report.harness_version, '7.0.0');
assert.equal(report.seed_count, 100);
assert.equal(report.axm_runtime_integrated, false);
assert.equal(report.canon, false);

const tests = run(['-B', '-m', 'unittest', 'discover', '-s', 'tests', '-v']);
const testOutput = `${tests.stdout}\n${tests.stderr}`;
assert.match(testOutput, /Ran 154 tests/);
assert.match(testOutput, /\bOK\b/);

console.log('AI Team Collaboration source harness: PASS (v7, 100 seeds, 154 unit tests)');

