'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const U = require('./operations-utils');
const GitHubSync = require('./github-sync-service');

const STATIC_ACTIONS = {
  verify: ['verify.js'],
  'html-syntax': ['tests/html-script-syntax-test.js'],
  'beginner-launch': ['tests/beginner-launch-selftest.js'],
  'hub-selftest': ['hub/hub-selftest.js'],
  'module-seams': ['hub/module-seam-audit-selftest.js']
};
const GITHUB_SYNC_ACTIONS = { 'github-sync-dry-run':'--dry-run' };

function create(options) {
  const root = options.root, stateDir = path.join(options.stateRoot, 'machine-host'), stateFile = path.join(stateDir, 'jobs.json'), logDir = path.join(stateDir, 'logs');
  const active = new Map();
  function read() { return U.loadJson(stateFile, { schema: 'axm.machine-host.jobs/v1', jobs: [] }); }
  function write(state) { state.jobs = state.jobs.slice(0, 200); state.updatedAt = U.now(); U.atomicJson(stateFile, state); }
  function reconcileInterruptedJobs() {
    const state = read(), endedAt = U.now();
    let recovered = 0;
    state.jobs.forEach(job => {
      if (job.state !== 'RUNNING') return;
      job.state = 'ERROR';
      job.endedAt = endedAt;
      job.exitCode = null;
      job.signal = 'host-restart';
      job.error = 'Machine Host restarted before a completion receipt was recorded.';
      recovered += 1;
    });
    if (recovered) write(state);
    return recovered;
  }
  function resolveAction(action, input) {
    if (STATIC_ACTIONS[action]) return { command: process.execPath, args: STATIC_ACTIONS[action].map(rel => path.join(root, rel)), label: action };
    if (GITHUB_SYNC_ACTIONS[action]) return { command:process.execPath, args:[path.join(root, 'tools', 'source-control-merge-workbench', 'sync-runner.js'), GITHUB_SYNC_ACTIONS[action]], label:action };
    if (action === 'github-sync-manual-reviewed') {
      const digest = String(input && input.planDigest || '').trim().toLowerCase();
      const confirmation = String(input && input.confirmation || '');
      const actor = String(input && input.actor || 'local-user').replace(/[\r\n\0]/g, ' ').trim().slice(0,120) || 'local-user';
      if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('an exact reviewed plan digest is required');
      if (confirmation !== GitHubSync.MANUAL_PUSH_CONFIRMATION) throw new Error('exact reviewed public snapshot confirmation is required');
      return {
        command:process.execPath,
        args:[path.join(root, 'tools', 'source-control-merge-workbench', 'sync-runner.js'), '--manual-reviewed-push', '--plan-digest', digest, '--confirmation', confirmation, '--actor', actor],
        label:action
      };
    }
    if (action === 'module-selftest') {
      const moduleId = U.cleanId(input && input.moduleId, 'moduleId'), file = path.join(root, 'tools', moduleId, 'selftest.js');
      if (!fs.existsSync(file)) throw new Error('module selftest is unavailable');
      U.assertUnder(file, path.join(root, 'tools'));
      return { command: process.execPath, args: [file], label: action + ':' + moduleId, moduleId };
    }
    throw new Error('machine action is not allowlisted');
  }
  function publicJob(job) { return Object.assign({}, job, { output: job.logFile ? U.readTail(job.logFile, 100000) : '' }); }
  function run(action, input) {
    if (active.size >= 2) throw new Error('machine host capacity is full');
    const resolved = resolveAction(action, input), id = U.uid('job'), logFile = path.join(logDir, id + '.log');
    fs.mkdirSync(logDir, { recursive: true });
    const state = read(), job = { id, action: resolved.label, moduleId: resolved.moduleId || null, state: 'RUNNING', command: path.basename(resolved.command), startedAt: U.now(), endedAt: null, exitCode: null, signal: null, logFile };
    state.jobs.unshift(job); write(state);
    const output = fs.createWriteStream(logFile, { flags: 'a' });
    output.write('AXM MACHINE HOST · ' + job.action + ' · ' + job.startedAt + '\n');
    const child = childProcess.spawn(resolved.command, resolved.args, { cwd: root, windowsHide: true, shell: false, env: Object.assign({}, process.env, { AXM_NO_BROWSER: '1' }), stdio: ['ignore', 'pipe', 'pipe'] });
    active.set(id, child); child.stdout.pipe(output); child.stderr.pipe(output);
    let settled = false;
    const finish = (exitCode, signal, error) => {
      if (settled) return;
      settled = true;
      active.delete(id); job.state = error ? 'ERROR' : exitCode === 0 ? 'PASS' : 'FAIL'; job.exitCode = Number.isInteger(exitCode) ? exitCode : null; job.signal = signal || null; job.error = error ? String(error.message || error).slice(0, 1000) : null; job.endedAt = U.now(); output.end('\nSTATE ' + job.state + ' · ' + job.endedAt + '\n');
      const latest = read(), stored = latest.jobs.find(item => item.id === id); if (stored) Object.assign(stored, job); else latest.jobs.unshift(job); write(latest);
    };
    child.once('error', error => finish(null, null, error));
    child.once('exit', (code, signal) => finish(code, signal, null));
    return publicJob(job);
  }
  function list() { return read().jobs.map(publicJob); }
  function get(id) { const job = read().jobs.find(item => item.id === id); return job ? publicJob(job) : null; }
  function stop(id) { const child = active.get(id); if (!child) throw new Error('job is not running'); child.kill(); return { id, stopRequested: true }; }
  function actions() { return Object.keys(STATIC_ACTIONS).concat(Object.keys(GITHUB_SYNC_ACTIONS), 'github-sync-manual-reviewed', 'module-selftest'); }
  const recoveredInterruptedJobs = reconcileInterruptedJobs();
  return { actions, resolveAction, run, list, get, stop, activeCount: () => active.size, recoveredInterruptedJobs, stateFile };
}

module.exports = { STATIC_ACTIONS, create };
