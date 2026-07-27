'use strict';

const childProcess = require('child_process');

const STATE_SCHEMA = 'axm.heartbeat-verification.state/v1';
const MODULE_ID = 'heartbeat-verifier';
const MAX_CHECKS_PER_WINDOW = 10;
const WINDOW_MS = 3600000;
const RUN_LIMIT = 96;
const CHECK_TIMEOUT_MS = 120000;

const CHECK_DECK = Object.freeze([
  { id: 'server-syntax', label: 'Workshop server syntax', args: ['--check', 'server.js'] },
  { id: 'heartbeat-core', label: 'Platform Heartbeat core', args: ['shared/heartbeat/selftest.js'] },
  { id: 'heartbeat-service', label: 'Platform Heartbeat service', args: ['shared/heartbeat/service-selftest.js'] },
  { id: 'body-pulse-core', label: 'Body Pulse core', args: ['shared/pulse/selftest.js'] },
  { id: 'body-pulse-service', label: 'Body Pulse service', args: ['shared/pulse/service-selftest.js'] },
  { id: 'body-pulse-surface', label: 'Body Pulse surface contract', args: ['tools/body-pulse/selftest.js'] },
  { id: 'hub-shell', label: 'Hub shell contract', args: ['hub/hub-selftest.js'] },
  { id: 'capability-index', label: 'Capability index', args: ['shared/capabilities/selftest.js'] },
  { id: 'readiness', label: 'Readiness contracts', args: ['shared/readiness/selftest.js'] },
  { id: 'continuity', label: 'Workshop continuity', args: ['shared/continuity/selftest.js'] },
  { id: 'handoffs', label: 'Artifact handoffs', args: ['shared/handoffs/selftest.js'] },
  { id: 'static-boundary', label: 'Static service boundary', args: ['shared/services/static-boundary-selftest.js'] },
  { id: 'direction-review', label: 'Direction review', args: ['shared/direction/review-selftest.js'] },
  { id: 'direction-service', label: 'Direction service', args: ['shared/direction/service-selftest.js'] },
  { id: 'direction-surface', label: 'Workshop Direction surface', args: ['tools/workshop-direction/selftest.js'] },
  { id: 'visual-kernel', label: 'Visual Kernel', args: ['shared/visual-kernel/selftest.js'] },
  { id: 'presentation-spine', label: 'Presentation Spine core', args: ['shared/presentation-spine/selftest.js'] },
  { id: 'presentation-surface', label: 'Presentation Spine surface', args: ['tools/presentation-spine/selftest.js'] },
  { id: 'visual-grammar', label: 'Visual Grammar', args: ['shared/visual-grammar/selftest.js'] },
  { id: 'technical-glasses', label: 'Technical Glasses', args: ['shared/technical-glasses/selftest.js'] },
  { id: 'beginner-launch', label: 'Downloaded Workshop beginner boot contract', args: ['tests/beginner-launch-selftest.js'] },
  { id: 'workshop-packager', label: 'Public-safe Workshop packager contract', args: ['tools/workshop-packager/selftest.js'] },
  { id: 'workshop-packager-mobile', label: 'Portable package and restore boundaries', args: ['tools/workshop-packager/mobile-selftest.js'] },
  { id: 'package-script-paths', label: 'Public package script paths', args: ['scripts/package-script-path-selftest.js'] },
  { id: 'verification-spine', label: 'Public release verification profile', args: ['shared/verification-spine/selftest.js'] },
  { id: 'workshop-updater-core', label: 'Workshop Updater trust core', args: ['shared/workshop-updater/selftest.js'] },
  { id: 'workshop-updater-service', label: 'Workshop Updater zero-network service', args: ['shared/workshop-updater/service-selftest.js'] },
  { id: 'workshop-updater-surface', label: 'Workshop Update Gate surface', args: ['tools/workshop-updater/selftest.js'] }
]);

function nowIso(now) { return new Date(now == null ? Date.now() : now).toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function tail(value, max) { const text = String(value || '').trim(); return text.slice(Math.max(0, text.length - (max || 1600))); }
function createState() {
  return { schema: STATE_SCHEMA, version: '0.1.0', pulseBootstrapApplied: false, pulseBootstrapMode: null, lastWindowAt: null, running: false, activeBeatId: null, lastReason: 'awaiting-scheduled-heartbeat', runs: [] };
}
function normalize(raw) {
  const state = raw && raw.schema === STATE_SCHEMA ? clone(raw) : createState();
  state.version = '0.1.0';
  state.pulseBootstrapApplied = state.pulseBootstrapApplied === true;
  state.pulseBootstrapMode = state.pulseBootstrapMode || null;
  state.running = state.running === true;
  state.runs = Array.isArray(state.runs) ? state.runs.slice(-RUN_LIMIT) : [];
  return state;
}
function selectedChecks(sequence) {
  const start = ((Math.max(1, Number(sequence) || 1) - 1) * MAX_CHECKS_PER_WINDOW) % CHECK_DECK.length;
  const selected = [];
  for (let i = 0; i < MAX_CHECKS_PER_WINDOW; i += 1) selected.push(CHECK_DECK[(start + i) % CHECK_DECK.length]);
  return selected;
}
function runCheck(root, check) {
  return new Promise(resolve => {
    const started = Date.now();
    const child = childProcess.spawn(process.execPath, check.args, { cwd: root, windowsHide: true, shell: false, env: Object.assign({}, processEnv(), { AXM_HEARTBEAT_VERIFICATION: '1' }) });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (status, exitCode, signal, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ checkId: check.id, label: check.label, status, exitCode, signal: signal || null, durationMs: Date.now() - started, summary: tail(status === 'PASS' ? stdout : (stderr || stdout || error), 1600) || (status === 'PASS' ? 'PASS' : 'No diagnostic output') });
    };
    child.stdout.on('data', chunk => { stdout += String(chunk); if (stdout.length > 10000) stdout = stdout.slice(-10000); });
    child.stderr.on('data', chunk => { stderr += String(chunk); if (stderr.length > 10000) stderr = stderr.slice(-10000); });
    child.on('error', error => finish('FAIL', null, null, error.message));
    child.on('close', (code, signal) => finish(code === 0 ? 'PASS' : 'FAIL', code, signal));
    const timeout = setTimeout(() => { try { child.kill(); } catch (error) {} finish('TIMEOUT', null, 'timeout'); }, CHECK_TIMEOUT_MS);
  });
}
function processEnv() { return typeof process !== 'undefined' && process.env ? process.env : {}; }

function create(options) {
  if (!options || !options.root || !options.bodyPulse || typeof options.read !== 'function' || typeof options.write !== 'function') throw new Error('Heartbeat verification bridge adapters required');
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const execute = typeof options.execute === 'function' ? options.execute : check => runCheck(options.root, check);
  let runningPromise = null;
  function read() { try { return normalize(options.read()); } catch (error) { return createState(); } }
  function write(state) { const value = normalize(state); options.write(value); return value; }
  function ensureModule() {
    const status = options.bodyPulse.status();
    if (!status.modules.some(module => module.moduleId === MODULE_ID)) {
      return options.bodyPulse.register({ moduleId: MODULE_ID, name: 'Heartbeat Verifier', goalQueueId: 'heartbeat-verification-goals', enabled: true, allowMaintenance: false, priority: 82, activeCadenceMs: 10000, idleCadenceMs: 3600000, cost: { cpu: 3, memory: 2, gpu: 0 }, authority: 'deterministic-verification-receipts-only', promotionGate: 'repair-finding-review' });
    }
    if (!status.modules.find(module => module.moduleId === MODULE_ID).enabled) return status;
    return status;
  }
  async function perform(beat) {
    let state = read();
    const stamp = now();
    if (!beat || beat.kind !== 'SCHEDULED') return { started: false, reason: 'manual-beats-do-not-spend-verification-pulses' };
    if (state.lastWindowAt && stamp - Date.parse(state.lastWindowAt) < WINDOW_MS) return { started: false, reason: 'ten-per-hour-cap' };
    const pulseStatus = ensureModule();
    if (pulseStatus.mode !== 'ACTIVE' && pulseStatus.mode !== 'CONSERVE') {
      state.lastWindowAt = nowIso(stamp);
      state.lastReason = 'body-pulse-' + String(pulseStatus.mode || 'unknown').toLowerCase();
      state.runs.push({ beatId: beat.beatId, beatSequence: beat.sequence, startedAt: nowIso(stamp), completedAt: nowIso(stamp), status: 'HELD', reason: state.lastReason, checks: [] });
      write(state);
      return { started: false, reason: state.lastReason };
    }
    const checks = selectedChecks(beat.sequence);
    const goalId = 'heartbeat-verification-' + beat.sequence;
    options.bodyPulse.goal({ goalId, moduleId: MODULE_ID, title: 'Heartbeat verification window #' + beat.sequence, priority: 82, maxPulses: MAX_CHECKS_PER_WINDOW, createdBy: 'mike-authorized-heartbeat', requiresReview: true });
    const run = { beatId: beat.beatId, beatSequence: beat.sequence, goalId, startedAt: nowIso(stamp), completedAt: null, status: 'RUNNING', reason: 'ten-check-window', checks: [] };
    state.running = true;
    state.activeBeatId = beat.beatId;
    state.lastWindowAt = nowIso(stamp);
    state.lastReason = 'verification-running';
    write(state);
    for (const check of checks) {
      const decision = options.bodyPulse.request({ moduleId: MODULE_ID, force: true, leaseMs: CHECK_TIMEOUT_MS });
      if (!decision.granted) {
        run.checks.push({ checkId: check.id, label: check.label, status: 'HELD', reason: decision.reason });
        run.reason = decision.reason;
        break;
      }
      const result = await execute(check);
      run.checks.push(result);
      options.bodyPulse.complete({ leaseId: decision.lease.leaseId, outcome: result.status === 'PASS' ? 'COMPLETED' : 'FAILED', summary: check.label + ': ' + result.status, effect: 'deterministic-test-receipt-only' });
    }
    options.bodyPulse.goal({ goalId, moduleId: MODULE_ID, title: 'Heartbeat verification window #' + beat.sequence, status: 'DONE', statusChangedBy: 'heartbeat-verification-bridge' });
    run.completedAt = nowIso(now());
    run.status = run.checks.length === checks.length && run.checks.every(item => item.status === 'PASS') ? 'PASS' : run.checks.some(item => item.status === 'FAIL' || item.status === 'TIMEOUT') ? 'ATTENTION' : 'HELD';
    state = read();
    state.running = false;
    state.activeBeatId = null;
    state.lastReason = run.status.toLowerCase();
    state.runs.push(run);
    state.runs = state.runs.slice(-RUN_LIMIT);
    write(state);
    return clone(run);
  }
  function onBeat(beat) {
    if (runningPromise) return runningPromise;
    runningPromise = perform(beat).finally(() => { runningPromise = null; });
    return runningPromise;
  }
  function status() {
    const state = read();
    const pulseStatus = options.bodyPulse.status();
    return {
      schema: 'axm.heartbeat-verification.status/v1',
      moduleId: MODULE_ID,
      state: state.running ? 'RUNNING' : 'IDLE',
      lastReason: state.lastReason,
      lastWindowAt: state.lastWindowAt,
      maxChecksPerHour: MAX_CHECKS_PER_WINDOW,
      deckSize: CHECK_DECK.length,
      repairAuthority: 'FINDINGS_ONLY',
      pulseMode: pulseStatus.mode,
      armed: pulseStatus.mode === 'ACTIVE' || pulseStatus.mode === 'CONSERVE',
      pulseBootstrapApplied: state.pulseBootstrapApplied,
      pulseBootstrapMode: state.pulseBootstrapMode,
      nextChecks: selectedChecks((state.runs.length ? state.runs[state.runs.length - 1].beatSequence : 0) + 1).map(item => ({ id: item.id, label: item.label })),
      recentRuns: clone(state.runs.slice(-12))
    };
  }
  let initial = read();
  ensureModule();
  if (!initial.pulseBootstrapApplied && options.bootstrapPulseMode) {
    const requestedMode = String(options.bootstrapPulseMode).toUpperCase();
    if (!['ACTIVE', 'CONSERVE'].includes(requestedMode)) throw new Error('Heartbeat verification bootstrap mode must be ACTIVE or CONSERVE');
    if (options.bodyPulse.status().mode === 'STOPPED') {
      options.bodyPulse.setMode({ mode: requestedMode, actorId: options.bootstrapActor || 'explicit-heartbeat-bootstrap' });
      initial.pulseBootstrapMode = requestedMode;
      initial.lastReason = 'pulse-' + requestedMode.toLowerCase() + '-explicit-heartbeat-bootstrap';
    } else {
      initial.pulseBootstrapMode = options.bodyPulse.status().mode;
    }
    initial.pulseBootstrapApplied = true;
  }
  write(initial);
  return { onBeat, status, selectedChecks, MODULE_ID, MAX_CHECKS_PER_WINDOW, CHECK_DECK: clone(CHECK_DECK) };
}

module.exports = { create, STATE_SCHEMA, MODULE_ID, MAX_CHECKS_PER_WINDOW, WINDOW_MS, CHECK_DECK: clone(CHECK_DECK), selectedChecks };
