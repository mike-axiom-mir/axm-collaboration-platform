'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PYTHON = path.join(ROOT, 'runtime', 'python', 'capability-intelligence', 'Scripts', 'python.exe');

function run(args, cwd, extraEnv) {
  assert.ok(fs.existsSync(PYTHON), 'isolated capability-intelligence Python runtime is missing');
  const result = childProcess.spawnSync(PYTHON, args, {
    cwd,
    windowsHide: true,
    timeout: 45000,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1' }, extraEnv || {})
  });
  assert.equal(result.error, undefined, result.error && result.error.message);
  assert.equal(result.status, 0, (result.stdout || '') + '\n' + (result.stderr || ''));
  return String(result.stdout || '');
}

function verify(id) {
  if (id === 'human-capability-atlas') {
    const engine = path.join(ROOT, 'tools', id, 'engine');
    const output = run(['verify_package.py'], engine, { PYTHONPATH: path.join(engine, 'src') });
    assert.ok(output.includes('538 package-integrity checks'), output);
    const info = run(['-m', 'axm_capability_atlas.cli', 'implementation-info'], engine, { PYTHONPATH: path.join(engine, 'src') });
    assert.ok(info.includes('bf78ef73303953b68166154077acd0ec07575d15e4d0a56db9ea94b4f1b98f0f'), info);
    return;
  }
  if (id === 'human-interface-intelligence') {
    const engine = path.join(ROOT, 'tools', id, 'engine');
    assert.ok(run(['-m', 'axm_hii.cli', 'verify-lock'], engine).includes('"overall_status": "PASS"'));
    assert.ok(run(['-m', 'axm_hii.cli', 'registry-check'], engine).includes('"valid": true'));
    run([path.join(ROOT, 'shared', 'capability-intelligence', 'selftest.py')], ROOT);
    return;
  }
  if (id === 'grounded-evolution-intelligence') {
    const engine = path.join(ROOT, 'tools', id, 'engine');
    assert.ok(run(['verify_package.py'], engine).includes('334 indexed files verified'));
    const bundle = path.join(ROOT, 'intakes', 'tri-20260809', 'source-zips', 'AXM_HUMAN_CAPABILITY_ATLAS_FINAL_LOCAL_INTAKE_v0_11_0.zip');
    const probe = run([path.join(ROOT, 'shared', 'capability-intelligence', 'trio.py'), 'probe-module1', bundle], ROOT);
    assert.ok(probe.includes('"status": "PASS"'), probe);
    return;
  }
  throw new Error('Unknown capability intelligence module: ' + id);
}

module.exports = { ROOT, PYTHON, run, verify };
