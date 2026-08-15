'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const Cell = require('../kernel/human-guided-runtime-control-cell');

const ORGAN_ID = 'axm.mirror.organ/human-guided-runtime-control-v1';
const ROOT = path.resolve(__dirname, '..');
const DEFAULT_RECEIPT_DIR = path.join(ROOT, 'state', 'human-guided-runtime-control-runs');

function readRuntimeConfig(root = ROOT) {
  const defaults = JSON.parse(fs.readFileSync(path.join(root, 'config', 'mirror.config.example.json'), 'utf8'));
  let local = {};
  try { local = JSON.parse(fs.readFileSync(path.join(root, 'config', 'mirror.config.local.json'), 'utf8')); } catch (_) {}
  const port = Number(process.env.AXM_MIRROR_PORT || local.port || defaults.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Mirror lifecycle controller found an invalid runtime port');
  return { host: '127.0.0.1', port };
}

function readPid(root = ROOT) {
  try {
    const value = Number(fs.readFileSync(path.join(root, 'state', 'runtime.pid'), 'utf8').trim());
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch (_) { return null; }
}

function requestJson(options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port: options.port,
      path: options.route,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeoutMs || 1500
    }, response => {
      const chunks = [];
      let bytes = 0;
      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 1024 * 1024) request.destroy(new Error('Mirror lifecycle response exceeded one MiB'));
        else chunks.push(chunk);
      });
      response.on('end', () => {
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); }
        catch (_) { return reject(new Error('Mirror lifecycle endpoint returned invalid JSON')); }
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(`Mirror lifecycle endpoint returned ${response.statusCode}: ${body.error || 'unknown error'}`));
        resolve(body);
      });
    });
    request.on('timeout', () => request.destroy(new Error('Mirror lifecycle endpoint timed out')));
    request.on('error', reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

function immutableReceipt(receipt, receiptDir = DEFAULT_RECEIPT_DIR) {
  const root = path.resolve(receiptDir);
  fs.mkdirSync(root, { recursive: true });
  const stat = fs.lstatSync(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('runtime control receipt root must be a real directory');
  const file = path.join(root, `${receipt.receiptId}.json`);
  if (path.dirname(file) !== root) throw new Error('runtime control receipt escaped its state root');
  const bytes = Buffer.from(JSON.stringify(Cell.stable(receipt), null, 2) + '\n');
  try { fs.writeFileSync(file, bytes, { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = fs.readFileSync(file);
    if (!existing.equals(bytes)) throw new Error('runtime control receipt identity collision');
  }
  return file;
}

function defaultSpawnRuntime(root) {
  const child = spawn(process.execPath, [path.join(root, 'runtime', 'server.js')], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: 'ignore'
  });
  child.unref();
  return { pid: child.pid };
}

function defaultSpawnTraining(root) {
  return spawn(process.execPath, [path.join(root, 'scripts', 'run-workshop-steward-curriculum.js')], {
    cwd: root,
    windowsHide: true,
    stdio: 'ignore'
  });
}

function delay(milliseconds) { return new Promise(resolve => setTimeout(resolve, milliseconds)); }

function createController(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const receiptDir = path.resolve(options.receiptDir || path.join(root, 'state', 'human-guided-runtime-control-runs'));
  const config = options.config || readRuntimeConfig(root);
  const now = options.now || (() => new Date().toISOString());
  const healthAdapter = options.health || (async () => requestJson({ port: config.port, route: '/health', timeoutMs: 1200 }));
  const stopAdapter = options.stop || (async () => {
    const token = fs.readFileSync(path.join(root, 'state', 'runtime-token.txt'), 'utf8').trim();
    if (token.length < 32) throw new Error('Mirror runtime token is absent or invalid');
    return requestJson({
      port: config.port,
      route: '/axm/v1/runtime/stop',
      method: 'POST',
      timeoutMs: 2000,
      headers: { authorization: `Bearer ${token}`, 'x-axm-mirror-action': 'explicit-stop', 'content-type': 'application/json', 'content-length': '2' },
      body: '{}'
    });
  });
  const spawnRuntime = options.spawnRuntime || (() => defaultSpawnRuntime(root));
  const spawnTraining = options.spawnTraining || (() => defaultSpawnTraining(root));
  const sleep = options.sleep || delay;
  const pidReader = options.readPid || (() => readPid(root));
  let manual = { state: 'IDLE', pid: null, lastCycleResult: null };
  let trainingChild = null;

  async function rawHealth() {
    try { return { observed: true, health: await healthAdapter() }; }
    catch (_) { return { observed: false, health: null }; }
  }

  async function getStatus() {
    const observed = await rawHealth();
    return Cell.status({
      runtimeOnline: observed.observed && observed.health && observed.health.ok === true,
      runtimeObserved: observed.observed,
      runtimePort: config.port,
      runtimePid: observed.observed && observed.health && observed.health.pid || pidReader(),
      automaticPracticeState: observed.health && observed.health.automaticPractice && observed.health.automaticPractice.state,
      automaticPracticeExecutionIsolation: observed.health && observed.health.automaticPractice && observed.health.automaticPractice.executionIsolation,
      automaticPracticeParentHealthLoopSeparated: observed.health && observed.health.automaticPractice && observed.health.automaticPractice.parentHealthLoopSeparated,
      automaticPracticeWorkerHandId: observed.health && observed.health.automaticPractice && observed.health.automaticPractice.workerHandId,
      manualTrainingState: manual.state,
      manualTrainingPid: manual.pid,
      lastCycleResult: manual.lastCycleResult
    });
  }

  function seal(action, actor, before, state, values = {}) {
    const receipt = Cell.receipt({
      action,
      actorId: actor.actorId,
      actorKind: actor.actorKind,
      state,
      at: values.at || now(),
      beforeStatusDigest: before.statusDigest,
      afterStatusDigest: values.afterStatusDigest === undefined ? null : values.afterStatusDigest,
      pid: values.pid,
      exitCode: values.exitCode,
      detail: values.detail
    });
    return { receipt, receiptFile: immutableReceipt(receipt, receiptDir) };
  }

  async function start(input = {}) {
    const before = Cell.assertCurrent(input.expectedStatusDigest, await getStatus());
    if (before.runtime.state === 'ONLINE') return Object.assign({ status: before }, seal('START_RUNTIME', input, before, 'ALREADY_ONLINE', { afterStatusDigest: before.statusDigest, pid: before.runtime.pid, detail: 'Mirror was already online; no second runtime was started.' }));
    if (before.runtime.state !== 'OFFLINE') return Object.assign({ status: before }, seal('START_RUNTIME', input, before, 'HOLD_STATUS_UNKNOWN', { afterStatusDigest: before.statusDigest, detail: 'Runtime health was unknown, so start was refused to avoid a duplicate process.' }));
    const launched = await Promise.resolve(spawnRuntime());
    let after = before;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await sleep(125);
      after = await getStatus();
      if (after.runtime.state === 'ONLINE') break;
    }
    const state = after.runtime.state === 'ONLINE' ? 'RUNTIME_STARTED' : 'HOLD_START_NOT_OBSERVED';
    return Object.assign({ status: after }, seal('START_RUNTIME', input, before, state, {
      afterStatusDigest: after.statusDigest,
      pid: launched && launched.pid || after.runtime.pid,
      detail: state === 'RUNTIME_STARTED' ? 'Exact local Mirror runtime became health-observable.' : 'The exact runtime process was requested but did not become health-observable within the bounded wait.'
    }));
  }

  async function pause(input = {}) {
    const before = Cell.assertCurrent(input.expectedStatusDigest, await getStatus());
    if (before.runtime.state === 'OFFLINE') return Object.assign({ status: before }, seal('PAUSE_RUNTIME', input, before, 'ALREADY_PAUSED', { afterStatusDigest: before.statusDigest, detail: 'Mirror was already offline.' }));
    if (before.runtime.state !== 'ONLINE') return Object.assign({ status: before }, seal('PAUSE_RUNTIME', input, before, 'HOLD_STATUS_UNKNOWN', { afterStatusDigest: before.statusDigest, detail: 'Runtime health was unknown, so no stop request was sent.' }));
    if (before.training.active) return Object.assign({ status: before }, seal('PAUSE_RUNTIME', input, before, 'HOLD_TRAINING_ACTIVE', { afterStatusDigest: before.statusDigest, pid: before.runtime.pid, detail: 'Pause held because a bounded training cycle was active; no force-kill was attempted.' }));
    await stopAdapter();
    let after = before;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await sleep(125);
      after = await getStatus();
      if (after.runtime.state === 'OFFLINE') break;
    }
    const state = after.runtime.state === 'OFFLINE' ? 'RUNTIME_PAUSED' : 'HOLD_PAUSE_NOT_OBSERVED';
    return Object.assign({ status: after }, seal('PAUSE_RUNTIME', input, before, state, {
      afterStatusDigest: after.statusDigest,
      pid: before.runtime.pid,
      detail: state === 'RUNTIME_PAUSED' ? 'Mirror accepted the authenticated explicit stop and became health-unavailable.' : 'The explicit stop was accepted but offline state was not observed within the bounded wait; no force-kill was used.'
    }));
  }

  async function train(input = {}) {
    const before = Cell.assertCurrent(input.expectedStatusDigest, await getStatus());
    if (before.runtime.state !== 'ONLINE') return Object.assign({ status: before }, seal('TRAIN_BOUNDED_CYCLE', input, before, 'HOLD_RUNTIME_OFFLINE', { afterStatusDigest: before.statusDigest, detail: 'Training requires the exact local Mirror runtime online.' }));
    if (before.training.active || trainingChild) return Object.assign({ status: before }, seal('TRAIN_BOUNDED_CYCLE', input, before, 'HOLD_TRAINING_ACTIVE', { afterStatusDigest: before.statusDigest, pid: before.training.manualCyclePid, detail: 'A bounded practice cycle is already pending or running; no concurrent cycle was started.' }));
    const child = spawnTraining();
    if (!child || !Number.isInteger(child.pid) || typeof child.once !== 'function') throw new Error('bounded training process could not be created');
    trainingChild = child;
    manual = { state: 'RUNNING', pid: child.pid, lastCycleResult: manual.lastCycleResult };
    const after = await getStatus();
    const started = seal('TRAIN_BOUNDED_CYCLE', input, before, 'TRAINING_STARTED', { afterStatusDigest: after.statusDigest, pid: child.pid, detail: 'One exact existing Workshop practice cycle started. Its candidates remain private and unpromoted.' });
    child.once('exit', async (code, signal) => {
      const exitCode = Number.isInteger(code) ? code : null;
      manual = { state: exitCode === 0 ? 'COMPLETE' : 'HELD', pid: null, lastCycleResult: exitCode === 0 ? 'PASS' : 'HELD' };
      trainingChild = null;
      const ended = await getStatus().catch(() => after);
      seal('TRAIN_BOUNDED_CYCLE', input, after, exitCode === 0 ? 'TRAINING_COMPLETE' : 'TRAINING_HELD', {
        afterStatusDigest: ended.statusDigest,
        pid: child.pid,
        exitCode,
        detail: exitCode === 0 ? 'The bounded private Workshop practice process completed.' : `The bounded practice process held or exited abnormally${signal ? ` (${signal})` : ''}; no promotion was attempted.`
      });
    });
    return Object.assign({ status: after }, started);
  }

  return { organ: { id: ORGAN_ID, status: 'TEST_EXPLICIT_LOOPBACK_RUNTIME_START_PAUSE_AND_BOUNDED_PRIVATE_TRAINING', learnedWeights: false }, status: getStatus, start, pause, train };
}

module.exports = { ORGAN_ID, DEFAULT_RECEIPT_DIR, readRuntimeConfig, readPid, requestJson, immutableReceipt, createController };
