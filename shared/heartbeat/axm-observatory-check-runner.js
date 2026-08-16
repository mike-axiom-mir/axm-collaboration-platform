#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const path = require('path');
const Adapter = require('./axm-observatory-deck-adapter');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const moduleId = argument('--module');
const requestedDigest = argument('--digest');
const root = path.resolve(__dirname, '..', '..');

try {
  const review = Adapter.reviewedModule(moduleId || '');
  if (!requestedDigest || requestedDigest !== review.digest) throw new Error('Reviewed digest argument mismatch');
  const inspection = Adapter.inspect(root, moduleId);
  if (inspection.status !== 'READY') throw new Error('Observatory check held: ' + inspection.reasons.join(', '));
  const result = childProcess.spawnSync(process.execPath, [path.join('tools', moduleId, 'selftest.js')], {
    cwd: root,
    windowsHide: true,
    shell: false,
    encoding: 'utf8',
    timeout: 110000,
    maxBuffer: 1024 * 1024,
    env: Object.assign({}, process.env, { AXM_HEARTBEAT_OBSERVATORY: '1' })
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Observatory selftest exited ' + result.status);
  process.stdout.write('PASS reviewed observatory execution surface ' + moduleId + ' ' + inspection.digestContract + ' ' + inspection.measuredDigest + '\n');
} catch (error) {
  process.stderr.write('HELD ' + error.message + '\n');
  process.exitCode = 1;
}
