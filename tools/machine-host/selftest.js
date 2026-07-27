'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const Host = require('../../shared/operations/machine-host');

const d = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json')));
const contract = JSON.parse(fs.readFileSync(path.join(d, 'module.contract.json')));
const app = fs.readFileSync(path.join(d, 'app.js'), 'utf8');
assert.equal(manifest.id, 'machine-host');
assert(manifest.permissions.includes('machine.execute'));
assert(contract.boundaries.refuses.includes('arbitrary-command'));
assert(!/cmd\.exe|powershell|shell\s*:/i.test(app));
assert(Object.keys(Host.STATIC_ACTIONS).includes('verify'));

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axm-machine-host-race-'));
  const fixture = path.join(root, 'tools', 'race-fixture');
  const stateRoot = path.join(root, 'state');
  const machineState = path.join(stateRoot, 'machine-host');
  fs.mkdirSync(fixture, { recursive: true });
  fs.writeFileSync(path.join(fixture, 'selftest.js'), "'use strict';\n");
  fs.mkdirSync(machineState, { recursive: true });
  fs.writeFileSync(path.join(machineState, 'jobs.json'), JSON.stringify({
    schema: 'axm.machine-host.jobs/v1',
    jobs: [{ id: 'stale-job', action: 'module-selftest:race-fixture', moduleId: 'race-fixture', state: 'RUNNING', startedAt: '2026-07-27T00:00:00.000Z', endedAt: null, exitCode: null, signal: null, logFile: null }]
  }));
  const originalSpawn = childProcess.spawn;
  try {
    childProcess.spawn = () => {
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => true;
      process.nextTick(() => {
        child.emit('error', new Error('deterministic spawn-race fixture'));
        child.emit('exit', 1, null);
      });
      return child;
    };
    const host = Host.create({ root, stateRoot });
    assert.equal(host.recoveredInterruptedJobs, 1);
    assert.equal(host.get('stale-job').state, 'ERROR');
    assert.equal(host.get('stale-job').signal, 'host-restart');
    assert(host.actions().includes('github-sync-manual-reviewed'));
    assert.throws(() => host.resolveAction('github-sync-manual-reviewed', { planDigest:'bad', confirmation:'PUSH REVIEWED PUBLIC SNAPSHOT' }), /exact reviewed plan digest/);
    assert.throws(() => host.resolveAction('github-sync-manual-reviewed', { planDigest:'a'.repeat(64), confirmation:'PUSH IT' }), /exact reviewed public snapshot confirmation/);
    const manual = host.resolveAction('github-sync-manual-reviewed', { planDigest:'a'.repeat(64), confirmation:'PUSH REVIEWED PUBLIC SNAPSHOT', actor:'Mike\nInjected' });
    assert.equal(manual.command, process.execPath);
    assert(manual.args.includes('--manual-reviewed-push') && manual.args.includes('a'.repeat(64)) && manual.args.includes('Mike Injected'));
    const started = host.run('module-selftest', { moduleId: 'race-fixture' });
    await new Promise(resolve => setTimeout(resolve, 60));
    const completed = host.get(started.id);
    assert.equal(completed.state, 'ERROR');
    assert.equal(host.activeCount(), 0);
    assert.match(completed.error, /deterministic spawn-race fixture/);
  } finally {
    childProcess.spawn = originalSpawn;
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log('PASS Machine Host - idempotent child completion, fixed actions, evidence, no arbitrary shell');
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
